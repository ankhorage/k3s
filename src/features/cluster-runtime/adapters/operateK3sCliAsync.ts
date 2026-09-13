import type { InfraResult } from '@ankhorage/contracts/infra';

import type {
  K3sClusterObservation,
  K3sClusterSpec,
  K3sNodeAccess,
} from '../../../types/k3sRuntime';
import { inspectK3sCliAsync, isK3sInstalledAsync, versionMatchesAsync } from './inspectK3sCliAsync';
import {
  commandFailed,
  delayAsync,
  invalidAccess,
  K3S_BINARY,
  type K3sCliContext,
  readinessTimeout,
  runNodeCommandAsync,
  success,
} from './k3sCliSupport';

export async function ensureK3sCliAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<K3sClusterObservation>> {
  const observed = await inspectK3sCliAsync(context, spec, access, signal);
  if (!observed.ok) return observed;
  if (observed.value.state === 'ready' && observed.value.configurationMatches) return observed;
  if (canResume(observed.value)) return resumeK3sNodesAsync(context, spec, access, signal);
  const script = await context.installScriptLoader(signal).catch(() => undefined);
  if (script === undefined || script.trim().length === 0) {
    return commandFailed('k3s-install-download-failed');
  }
  const primary = access.find(({ node }) => node.role === 'server');
  if (primary === undefined) return invalidAccess();
  const primaryReady = await installOrStartNodeAsync(
    context,
    spec,
    primary,
    script,
    undefined,
    signal,
  );
  if (!primaryReady.ok) return primaryReady;
  const token = await readJoinTokenAsync(context, primary, signal);
  if (!token.ok) return token;
  const join = { serverUrl: `https://${getNodeHost(primary)}:6443`, token: token.value };
  for (const node of access.filter(({ node }) => node.id !== primary.node.id)) {
    const ready = await installOrStartNodeAsync(context, spec, node, script, join, signal);
    if (!ready.ok) return ready;
  }
  return inspectK3sCliAsync(context, spec, access, signal);
}

export async function waitForK3sCliAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<K3sClusterObservation>> {
  const deadline = Date.now() + context.readinessTimeoutSeconds * 1_000;
  for (;;) {
    const observed = await inspectK3sCliAsync(context, spec, access, signal);
    if (!observed.ok) return observed;
    if (observed.value.state === 'ready') {
      const ready = await inspectK3sApiAsync(context, access, signal);
      if (ready.ok) return observed;
    }
    if (Date.now() >= deadline) return readinessTimeout();
    await delayAsync(Math.min(context.pollIntervalMs, Math.max(0, deadline - Date.now())), signal);
  }
}

export async function loadK3sImagesAsync(
  context: K3sCliContext,
  _spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  images: readonly string[],
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  for (const node of access) {
    for (const image of images) {
      const pulled = await runNodeCommandAsync(
        context,
        node,
        K3S_BINARY,
        ['ctr', 'images', 'pull', image],
        signal,
      );
      if (!pulled.ok) return pulled;
    }
  }
  return success(null);
}

export async function suspendK3sCliAsync(
  context: K3sCliContext,
  _spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  for (const node of [...access].reverse()) {
    const stopped = await runNodeCommandAsync(
      context,
      node,
      'systemctl',
      ['stop', getService(node)],
      signal,
    );
    if (!stopped.ok) return stopped;
  }
  return success(null);
}

export async function destroyK3sCliAsync(
  context: K3sCliContext,
  _spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  for (const node of [...access].reverse()) {
    const installed = await isK3sInstalledAsync(context, node, signal);
    if (!installed.ok) return installed;
    if (!installed.value) continue;
    const script =
      node.node.role === 'server'
        ? '/usr/local/bin/k3s-uninstall.sh'
        : '/usr/local/bin/k3s-agent-uninstall.sh';
    const destroyed = await runNodeCommandAsync(context, node, script, [], signal);
    if (!destroyed.ok) return destroyed;
  }
  return success(null);
}

async function resumeK3sNodesAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<K3sClusterObservation>> {
  for (const node of access) {
    const started = await runNodeCommandAsync(
      context,
      node,
      'systemctl',
      ['enable', '--now', getService(node)],
      signal,
    );
    if (!started.ok) return started;
  }
  return inspectK3sCliAsync(context, spec, access, signal);
}

async function installOrStartNodeAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  access: K3sNodeAccess,
  script: string,
  join: { readonly serverUrl: string; readonly token: string } | undefined,
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  const installed = await isK3sInstalledAsync(context, access, signal);
  if (!installed.ok) return installed;
  const matches = installed.value && (await versionMatchesAsync(context, access, spec, signal));
  if (matches) {
    return runNodeCommandAsync(
      context,
      access,
      'systemctl',
      ['enable', '--now', getService(access)],
      signal,
    );
  }
  const environment: Record<string, string> = {
    INSTALL_K3S_EXEC: createInstallExec(spec, access, join),
    INSTALL_K3S_SKIP_START: 'false',
    ...(spec.version === undefined ? {} : { INSTALL_K3S_VERSION: spec.version }),
    ...(join === undefined ? {} : { K3S_URL: join.serverUrl, K3S_TOKEN: join.token }),
  };
  return runNodeCommandAsync(context, access, 'sh', ['-s', '-'], signal, script, environment);
}

async function inspectK3sApiAsync(
  context: K3sCliContext,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  const primary = access.find(({ node }) => node.role === 'server');
  if (primary === undefined) return invalidAccess();
  return runNodeCommandAsync(
    context,
    primary,
    K3S_BINARY,
    ['kubectl', 'get', '--raw=/readyz'],
    signal,
  );
}

async function readJoinTokenAsync(
  context: K3sCliContext,
  primary: K3sNodeAccess,
  signal?: AbortSignal,
): Promise<InfraResult<string>> {
  const result = await context.executor.runAsync(primary, {
    executable: 'cat',
    arguments: ['/var/lib/rancher/k3s/server/node-token'],
    ...(signal === undefined ? {} : { signal }),
  });
  const token = result.stdout.trim();
  return result.exitCode === 0 && token.length > 0
    ? success(token)
    : commandFailed('k3s-join-token-unavailable');
}

function canResume(observation: K3sClusterObservation): boolean {
  return observation.nodes.every(
    ({ state, configurationMatches }) => state !== 'absent' && configurationMatches,
  );
}

function createInstallExec(
  spec: K3sClusterSpec,
  access: K3sNodeAccess,
  join: { readonly serverUrl: string; readonly token: string } | undefined,
): string {
  if (access.node.role === 'agent') return 'agent';
  if (join !== undefined) return 'server';
  return spec.topology.servers > 1 ? 'server --cluster-init' : 'server';
}

function getNodeHost(access: K3sNodeAccess): string {
  return access.transport.kind === 'ssh' ? access.transport.host : '127.0.0.1';
}

function getService(access: K3sNodeAccess): 'k3s' | 'k3s-agent' {
  return access.node.role === 'server' ? 'k3s' : 'k3s-agent';
}
