import type { InfraComputeTarget } from '@ankhorage/contracts/infra';
import { expect, it } from 'bun:test';

import { createK3sCliControlPlane } from './features/cluster-runtime/adapters/createK3sCliControlPlane';
import type {
  K3sClusterSpec,
  K3sNodeAccess,
  K3sNodeCommandExecutor,
  K3sNodeCommandRequest,
  K3sNodeCommandResult,
} from './index';

it('runs the concrete single-node lifecycle and resumes without downloading again', async () => {
  const executor = new RecordingExecutor();
  let downloads = 0;
  const controlPlane = createK3sCliControlPlane({
    executor,
    installScriptLoader: () => {
      downloads += 1;
      return Promise.resolve('official-installer');
    },
    pollIntervalMs: 0,
    readinessTimeoutSeconds: 1,
  });
  const { spec, access } = createLocalFixture();

  expect((await controlPlane.validateAsync(spec, access)).ok).toBe(true);
  expect((await controlPlane.inspectAsync(spec, access)).ok).toBe(true);
  expect((await controlPlane.ensureAsync(spec, access)).ok).toBe(true);
  expect(downloads).toBe(1);
  expect((await controlPlane.waitUntilReadyAsync(spec, access)).ok).toBe(true);
  expect((await controlPlane.loadImagesAsync(spec, access, ['nginx:1.27-alpine'])).ok).toBe(true);
  expect((await controlPlane.suspendAsync(spec, access)).ok).toBe(true);
  expect((await controlPlane.ensureAsync(spec, access)).ok).toBe(true);
  expect(downloads).toBe(1);
  expect((await controlPlane.destroyAsync(spec, access)).ok).toBe(true);
  const absent = await controlPlane.inspectAsync(spec, access);
  expect(absent.ok && absent.value.state).toBe('absent');
});

it('bootstraps multi-node servers and agents through the same transient access boundary', async () => {
  const executor = new RecordingExecutor();
  const controlPlane = createK3sCliControlPlane({
    executor,
    installScriptLoader: () => Promise.resolve('official-installer'),
  });
  const { spec, access } = createRemoteFixture();

  const ensured = await controlPlane.ensureAsync(spec, access);
  expect(ensured.ok && ensured.value.state).toBe('ready');
  const installs = executor.requests.filter(
    ({ request }) => request.stdin === 'official-installer',
  );
  expect(installs).toHaveLength(3);
  expect(installs[0]?.request.environment?.INSTALL_K3S_EXEC).toBe('server --cluster-init');
  expect(installs[1]?.request.environment?.K3S_TOKEN).toBe('join-token');
  expect(installs[2]?.request.environment?.INSTALL_K3S_EXEC).toBe('agent');
  expect(JSON.stringify(ensured)).not.toContain('join-token');
});

class RecordingExecutor implements K3sNodeCommandExecutor {
  readonly requests: { readonly nodeId: string; readonly request: K3sNodeCommandRequest }[] = [];
  private readonly installed = new Set<string>();
  private readonly states = new Map<string, 'ready' | 'stopped'>();

  runAsync(access: K3sNodeAccess, request: K3sNodeCommandRequest): Promise<K3sNodeCommandResult> {
    const { id } = access.node;
    this.requests.push({ nodeId: id, request });
    const systemd = this.handleSystemd(id, request);
    return Promise.resolve(systemd ?? this.handleCommand(id, request));
  }

  private handleSystemd(
    id: string,
    request: K3sNodeCommandRequest,
  ): K3sNodeCommandResult | undefined {
    if (request.executable === 'systemctl' && request.arguments[0] === 'is-active') {
      const state = this.states.get(id);
      return state === 'ready'
        ? result(0, 'active\n')
        : state === 'stopped'
          ? result(3, 'inactive\n')
          : result(4, 'unknown\n');
    }
    if (request.executable === 'systemctl' && request.arguments[0] === 'stop') {
      this.states.set(id, 'stopped');
      return result(0);
    }
    if (request.executable === 'systemctl' && request.arguments.includes('--now')) {
      this.states.set(id, 'ready');
      return result(0);
    }
    return undefined;
  }

  private handleCommand(id: string, request: K3sNodeCommandRequest): K3sNodeCommandResult {
    if (request.executable === 'sh' && request.arguments[1]?.startsWith('test -x')) {
      return result(this.installed.has(id) ? 0 : 1);
    }
    if (request.executable === 'sh' && request.stdin === 'official-installer') {
      this.installed.add(id);
      this.states.set(id, 'ready');
      return result(0);
    }
    if (request.executable === 'cat') return result(0, 'join-token\n');
    if (request.executable.endsWith('uninstall.sh')) {
      this.installed.delete(id);
      this.states.delete(id);
      return result(0);
    }
    return result(0);
  }
}

function createLocalFixture(): {
  readonly spec: K3sClusterSpec;
  readonly access: readonly K3sNodeAccess[];
} {
  const target: InfraComputeTarget = {
    id: 'local',
    kind: 'local-host',
    os: 'linux',
    architecture: 'amd64',
  };
  const node = { id: 'local', role: 'server' as const, target };
  return {
    spec: {
      projectId: 'sample',
      environment: 'local',
      name: 'sample-local',
      topology: { servers: 1, agents: 0 },
      nodes: [node],
    },
    access: [{ node, transport: { kind: 'local' } }],
  };
}

function createRemoteFixture(): {
  readonly spec: K3sClusterSpec;
  readonly access: readonly K3sNodeAccess[];
} {
  const targets = ['server-a', 'server-b', 'agent-a'].map((id) => ({
    id,
    kind: 'ssh-host' as const,
    os: 'linux' as const,
    architecture: 'amd64' as const,
    host: `${id}.example.test`,
    port: 22,
    user: 'root',
    hostKeyFingerprint: `SHA256:${id}`,
    credential: { source: 'control-plane' as const, name: `SSH_${id}` },
  }));
  const nodes = targets.map((target, index) => ({
    id: target.id,
    role: index < 2 ? ('server' as const) : ('agent' as const),
    target,
  }));
  return {
    spec: {
      projectId: 'sample',
      environment: 'production',
      name: 'sample-production',
      topology: { servers: 2, agents: 1 },
      nodes,
    },
    access: nodes.map((node) => ({
      node,
      transport: {
        kind: 'ssh' as const,
        host: node.target.host,
        port: node.target.port,
        user: node.target.user,
        hostKeyFingerprint: node.target.hostKeyFingerprint,
        credential: { privateKey: 'private-key' },
      },
    })),
  };
}

function result(exitCode: number, stdout = ''): K3sNodeCommandResult {
  return { exitCode, stdout, stderr: '' };
}
