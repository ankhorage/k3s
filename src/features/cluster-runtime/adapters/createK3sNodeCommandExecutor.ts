import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type {
  K3sNodeAccess,
  K3sNodeCommandExecutor,
  K3sNodeCommandRequest,
  K3sNodeCommandResult,
} from '../../../types/k3sRuntime';

/** Create the shell-free local and host-key-pinned SSH execution boundary. */
export function createK3sNodeCommandExecutor(): K3sNodeCommandExecutor {
  return {
    runAsync: (access, request) => {
      if (access.transport.kind === 'local') return runSubprocessAsync(request);
      return runSshAsync({ node: access.node, transport: access.transport }, request);
    },
  };
}

async function runSshAsync(
  access: Extract<K3sNodeAccess, { readonly transport: { readonly kind: 'ssh' } }>,
  request: K3sNodeCommandRequest,
): Promise<K3sNodeCommandResult> {
  const { privateKey } = access.transport.credential;
  if (privateKey === undefined || privateKey.trim().length === 0) {
    return { exitCode: 1, stdout: '', stderr: 'SSH credential is missing a privateKey.' };
  }
  const verified = await scanAndVerifyHostAsync(access, request.signal);
  if (verified.exitCode !== 0) return verified;
  return runVerifiedSshAsync(access, request, privateKey, verified.stdout);
}

async function scanAndVerifyHostAsync(
  access: Extract<K3sNodeAccess, { readonly transport: { readonly kind: 'ssh' } }>,
  signal?: AbortSignal,
): Promise<K3sNodeCommandResult> {
  const scan = await runSubprocessAsync({
    executable: 'ssh-keyscan',
    arguments: ['-p', String(access.transport.port), access.transport.host],
    ...(signal === undefined ? {} : { signal }),
  });
  if (scan.exitCode !== 0 || scan.stdout.trim().length === 0) return scan;
  const fingerprint = await runSubprocessAsync({
    executable: 'ssh-keygen',
    arguments: ['-lf', '-', '-E', 'sha256'],
    stdin: scan.stdout,
    ...(signal === undefined ? {} : { signal }),
  });
  if (
    fingerprint.exitCode !== 0 ||
    !fingerprint.stdout
      .split('\n')
      .some((line) => line.split(/\s+/).includes(access.transport.hostKeyFingerprint))
  ) {
    return { exitCode: 1, stdout: '', stderr: 'SSH host key fingerprint does not match.' };
  }
  return { exitCode: 0, stdout: scan.stdout, stderr: '' };
}

async function runVerifiedSshAsync(
  access: Extract<K3sNodeAccess, { readonly transport: { readonly kind: 'ssh' } }>,
  request: K3sNodeCommandRequest,
  privateKey: string,
  knownHosts: string,
): Promise<K3sNodeCommandResult> {
  const directory = await mkdtemp(join(tmpdir(), 'ankhorage-k3s-ssh-'));
  const keyPath = join(directory, 'identity');
  const knownHostsPath = join(directory, 'known_hosts');
  try {
    await writeFile(keyPath, `${privateKey.trimEnd()}\n`, { mode: 0o600 });
    await writeFile(knownHostsPath, knownHosts, { mode: 0o600 });
    return await runSubprocessAsync({
      executable: 'ssh',
      arguments: [
        '-p',
        String(access.transport.port),
        '-i',
        keyPath,
        '-o',
        'BatchMode=yes',
        '-o',
        'IdentitiesOnly=yes',
        '-o',
        'StrictHostKeyChecking=yes',
        '-o',
        `UserKnownHostsFile=${knownHostsPath}`,
        `${access.transport.user}@${access.transport.host}`,
        '--',
        createRemoteCommand(request),
      ],
      ...(createRemoteStdin(request) === undefined ? {} : { stdin: createRemoteStdin(request) }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createRemoteCommand(request: K3sNodeCommandRequest): string {
  const environment = getRemoteEnvironment(request);
  const command = [quote(request.executable), ...request.arguments.map(quote)];
  if (environment.length === 0) return ['exec', ...command].join(' ');
  const reads = environment.map(([name]) => `IFS= read -r ${name} || exit 1; export ${name};`);
  return [
    'exec',
    quote('sh'),
    quote('-c'),
    quote(`${reads.join(' ')} exec "$@"`),
    quote('ankhorage-k3s'),
    ...command,
  ].join(' ');
}

function createRemoteStdin(request: K3sNodeCommandRequest): string | undefined {
  const environment = getRemoteEnvironment(request);
  if (environment.length === 0) return request.stdin;
  return `${environment.map(([, value]) => value).join('\n')}\n${request.stdin ?? ''}`;
}

function getRemoteEnvironment(
  request: K3sNodeCommandRequest,
): readonly (readonly [string, string])[] {
  return Object.entries(request.environment ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => {
      if (!/^[A-Z_][A-Z0-9_]*$/.test(name) || /[\r\n]/.test(value)) {
        throw new TypeError('Invalid remote environment binding.');
      }
      return [name, value] as const;
    });
}

function quote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function runSubprocessAsync(request: K3sNodeCommandRequest): Promise<K3sNodeCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(request.executable, [...request.arguments], {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...request.environment },
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (exitCode) =>
      resolve({
        exitCode: exitCode ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }),
    );
    child.stdin.end(request.stdin);
  });
}
