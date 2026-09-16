import type {
  InfraExecutionContext,
  InfraRuntimeDesiredState,
  InfraWorkloadSpec,
} from '@ankhorage/contracts/infra';
import { expect, it } from 'bun:test';

import { createInfraAdapter } from './index';
import { FakeK3sControlPlane } from './runtimeFixtures.test';

it('plans and converges the complete local k3s lifecycle', async () => {
  const controlPlane = new FakeK3sControlPlane();
  const adapter = createInfraAdapter({ controlPlane });
  const context = createContext('local');
  const desired = createLocalDesired();

  const initial = await adapter.planAsync(context, desired);
  expect(initial.ok && initial.value.every(({ operation }) => operation === 'create')).toBe(true);
  const ensured = await adapter.ensureAsync(context, desired);
  expect(ensured.ok).toBe(true);
  expect(controlPlane.calls).toContain('images:registry.example/api@sha256:abc');
  const converged = await adapter.planAsync(context, desired);
  expect(converged.ok && converged.value.every(({ operation }) => operation === 'noop')).toBe(true);
  const status = await adapter.statusAsync(context, desired);
  expect(status.ok && status.value.every(({ state }) => state === 'ready')).toBe(true);
  expect((await adapter.suspendAsync(context, desired)).ok).toBe(true);
  expect(controlPlane.state).toBe('stopped');
  expect((await adapter.planAsync(context, desired)).ok).toBe(false);
  expect((await adapter.ensureAsync(context, desired)).ok).toBe(true);
  expect((await adapter.destroyAsync(context, desired, createDestroyRequest('local'))).ok).toBe(
    true,
  );
  expect(controlPlane.state).toBe('absent');
});

it('bootstraps deterministic remote multi-node topology with transient SSH credentials', async () => {
  const controlPlane = new FakeK3sControlPlane();
  const adapter = createInfraAdapter({ controlPlane });
  const context = createContext('production');
  const desired = createRemoteDesired();

  const result = await adapter.ensureAsync(context, desired);
  expect(result.ok).toBe(true);
  expect(controlPlane.lastAccess.map(({ node }) => `${node.id}:${node.role}`)).toEqual([
    'server-a:server',
    'agent-a:agent',
    'agent-b:agent',
  ]);
  expect(controlPlane.lastSpec?.networking?.tls).toEqual({
    mode: 'acme-http-01',
    contactEmail: 'infra@example.ch',
  });
  const remote = controlPlane.lastAccess.find(({ node }) => node.id === 'server-a');
  expect(remote?.transport.kind === 'ssh' && remote.transport.hostKeyFingerprint).toBe(
    'SHA256:server-a',
  );
  expect(JSON.stringify(result)).not.toContain('private-key');
});

it('projects the same generic Kubernetes workloads for single-node and multi-node topology', async () => {
  const context = createContext('production');
  const singleControlPlane = new FakeK3sControlPlane();
  const multiControlPlane = new FakeK3sControlPlane();
  const single = createInfraAdapter({ controlPlane: singleControlPlane });
  const multi = createInfraAdapter({ controlPlane: multiControlPlane });

  const singleResult = await single.ensureAsync(
    context,
    createRemoteDesired({ servers: 1, agents: 0 }),
  );
  const multiResult = await multi.ensureAsync(
    context,
    createRemoteDesired({ servers: 2, agents: 1 }),
  );

  expect(singleResult.ok).toBe(true);
  expect(multiResult.ok).toBe(true);
  expect(singleControlPlane.lastSpec?.topology).toEqual({ servers: 1, agents: 0 });
  expect(multiControlPlane.lastSpec?.topology).toEqual({ servers: 2, agents: 1 });
  expect(multiControlPlane.api.resources).toEqual(singleControlPlane.api.resources);
});

it('retains the k3s cluster when persistent workload data is not authorized for deletion', async () => {
  const controlPlane = new FakeK3sControlPlane();
  const adapter = createInfraAdapter({ controlPlane });
  const context = createContext('local');
  const desired = createLocalDesired(true);
  expect((await adapter.ensureAsync(context, desired)).ok).toBe(true);

  const result = await adapter.destroyAsync(context, desired, createDestroyRequest('local'));
  expect(result.ok && result.value.resources.some(({ persistent }) => persistent)).toBe(true);
  expect(controlPlane.calls).not.toContain('destroy');
});

it('refuses cluster deletion while retained resources cannot be inspected', async () => {
  const controlPlane = new FakeK3sControlPlane();
  const adapter = createInfraAdapter({ controlPlane });
  const context = createContext('local');
  const desired = createLocalDesired();
  expect((await adapter.ensureAsync(context, desired)).ok).toBe(true);
  expect((await adapter.suspendAsync(context, desired)).ok).toBe(true);

  const result = await adapter.destroyAsync(context, desired, createDestroyRequest('local'));
  expect(result.ok).toBe(false);
  expect(controlPlane.calls).not.toContain('destroy');
});

it('rejects topology without exactly one Linux target per node', async () => {
  const controlPlane = new FakeK3sControlPlane();
  const adapter = createInfraAdapter({ controlPlane });
  const desired: InfraRuntimeDesiredState<'k3s'> = {
    ...createLocalDesired(),
    selection: { provider: 'k3s', topology: { servers: 1, agents: 1 } },
  };

  const result = await adapter.validateAsync(createContext('local'), desired);
  expect(result.ok).toBe(false);
});

function createLocalDesired(persistent = false): InfraRuntimeDesiredState<'k3s'> {
  return {
    selection: { provider: 'k3s' },
    targets: [{ id: 'local', kind: 'local-host', os: 'linux', architecture: 'arm64' }],
    workloads: [createWorkload(persistent)],
    availableOutputs: [],
  };
}

function createRemoteDesired(
  topology: { readonly servers: number; readonly agents: number } = { servers: 1, agents: 2 },
): InfraRuntimeDesiredState<'k3s'> {
  const ids = [
    ...Array.from(
      { length: topology.servers },
      (_, index) => `server-${String.fromCharCode(97 + index)}`,
    ),
    ...Array.from(
      { length: topology.agents },
      (_, index) => `agent-${String.fromCharCode(97 + index)}`,
    ),
  ];
  return {
    selection: { provider: 'k3s', topology },
    targets: ids.map((id) => ({
      id,
      kind: 'ssh-host' as const,
      os: 'linux' as const,
      architecture: 'amd64' as const,
      host: `${id}.example.test`,
      port: 22,
      user: 'root',
      hostKeyFingerprint: `SHA256:${id}`,
      credential: { source: 'control-plane' as const, name: `SSH_${id}` },
    })),
    workloads: [createWorkload(false)],
    availableOutputs: [],
  };
}

function createWorkload(persistent: boolean): InfraWorkloadSpec {
  return {
    id: 'api',
    artifact: { kind: 'image', image: 'registry.example/api@sha256:abc' },
    ports: [{ name: 'http', port: 8080 }],
    exposure: 'public',
    ...(persistent
      ? { persistence: [{ id: 'data', mountPath: '/data', sizeGiB: 1, retention: 'retain' }] }
      : {}),
  };
}

function createContext(environment: 'local' | 'production'): InfraExecutionContext {
  return {
    projectId: 'sample',
    environment,
    desired: {
      deployment:
        environment === 'local'
          ? { compute: { provider: 'local' }, runtime: { provider: 'k3s' } }
          : {
              compute: { provider: 'hetzner', location: 'fsn1' },
              runtime: { provider: 'k3s' },
            },
      networking:
        environment === 'production'
          ? {
              domain: 'api.sample.test',
              publicBaseUrl: 'https://api.sample.test',
              tls: { mode: 'acme-http-01', contactEmail: 'infra@example.ch' },
            }
          : { domain: 'api.sample.test' },
    },
    credentials: {
      resolveAsync: () =>
        Promise.resolve({ ok: true, value: { privateKey: 'private-key' }, diagnostics: [] }),
    },
    secrets: {
      resolveAsync: () => Promise.resolve({ ok: true, value: 'secret', diagnostics: [] }),
    },
  };
}

function createDestroyRequest(environment: 'local' | 'production') {
  return {
    projectId: 'sample',
    environment,
    confirmation: { projectId: 'sample', environment },
    persistence: { policy: 'retain' as const },
  };
}
