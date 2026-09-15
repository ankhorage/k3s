import { expect, it } from 'bun:test';

import type { K3sCliContext } from './features/cluster-runtime/adapters/k3sCliSupport';
import { reconcileK3sNetworkingAsync } from './features/cluster-runtime/adapters/reconcileK3sNetworkingAsync';
import { createK3sTraefikConfigResource } from './features/cluster-runtime/utils/createK3sTraefikConfigResource';
import type {
  K3sClusterSpec,
  K3sNodeAccess,
  K3sNodeCommandExecutor,
  K3sNodeCommandRequest,
  K3sNodeCommandResult,
} from './types/k3sRuntime';

it('applies owned Traefik ACME configuration and waits for Traefik readiness', async () => {
  const executor = new NetworkingExecutor();
  const result = await reconcileK3sNetworkingAsync(
    createContext(executor),
    createSpec(true),
    createPrimaryAccess(),
  );

  expect(result.ok).toBe(true);
  expect(executor.applied).toContain('"kind":"HelmChartConfig"');
  expect(executor.applied).toContain('infra@example.ch');
  expect(executor.applied).toContain('acme.httpchallenge.entrypoint=web');
  expect(executor.applied).toContain('websecure.http.tls.certresolver=ankhorage');
  expect(executor.applied).toContain('persistence:');
  expect(executor.commands.some((command) => command.includes('rollout status'))).toBe(true);
});

it('converges without rewriting matching owned Traefik configuration', async () => {
  const spec = createSpec(true);
  const executor = new NetworkingExecutor(JSON.stringify(createK3sTraefikConfigResource(spec)));
  const result = await reconcileK3sNetworkingAsync(
    createContext(executor),
    spec,
    createPrimaryAccess(),
  );

  expect(result.ok).toBe(true);
  expect(executor.applied).toBeUndefined();
  expect(executor.commands.some((command) => command.includes(' apply '))).toBe(false);
});

it('refuses to overwrite a foreign Traefik singleton configuration', async () => {
  const executor = new NetworkingExecutor(
    JSON.stringify({
      apiVersion: 'helm.cattle.io/v1',
      kind: 'HelmChartConfig',
      metadata: { name: 'traefik', namespace: 'kube-system', labels: {} },
      spec: { valuesContent: 'foreign: true\n' },
    }),
  );
  const result = await reconcileK3sNetworkingAsync(
    createContext(executor),
    createSpec(true),
    createPrimaryAccess(),
  );

  expect(result.ok).toBe(false);
  expect(result.diagnostics[0]?.code).toBe('k3s-traefik-config-conflict');
  expect(executor.applied).toBeUndefined();
});

it('deletes only an owned Traefik TLS override when TLS intent is removed', async () => {
  const owned = createK3sTraefikConfigResource(createSpec(true));
  const executor = new NetworkingExecutor(JSON.stringify(owned));
  const result = await reconcileK3sNetworkingAsync(
    createContext(executor),
    createSpec(false),
    createPrimaryAccess(),
  );

  expect(result.ok).toBe(true);
  expect(executor.commands.some((command) => command.includes(' delete '))).toBe(true);
});

class NetworkingExecutor implements K3sNodeCommandExecutor {
  readonly commands: string[] = [];
  applied?: string;

  constructor(private current?: string) {}

  runAsync(_access: K3sNodeAccess, request: K3sNodeCommandRequest): Promise<K3sNodeCommandResult> {
    this.commands.push([request.executable, ...request.arguments].join(' '));
    if (request.arguments.includes('get')) {
      return Promise.resolve({ exitCode: 0, stdout: this.current ?? '', stderr: '' });
    }
    if (request.arguments.includes('apply')) {
      this.applied = request.stdin;
      this.current = request.stdin;
    }
    if (request.arguments.includes('delete')) this.current = undefined;
    return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
  }
}

function createContext(executor: K3sNodeCommandExecutor): K3sCliContext {
  return {
    executor,
    installScriptLoader: () => Promise.resolve(''),
    pollIntervalMs: 0,
    readinessTimeoutSeconds: 30,
  };
}

function createSpec(tls: boolean): K3sClusterSpec {
  const target = { id: 'server', kind: 'local-host', os: 'linux', architecture: 'amd64' } as const;
  return {
    projectId: 'sample',
    environment: 'production',
    name: 'sample-production',
    topology: { servers: 1, agents: 0 },
    nodes: [{ id: target.id, role: 'server', target }],
    networking: {
      domain: 'api.sample.test',
      publicBaseUrl: tls ? 'https://api.sample.test' : 'http://api.sample.test',
      ...(tls ? { tls: { mode: 'acme-http-01' as const, contactEmail: 'infra@example.ch' } } : {}),
    },
  };
}

function createPrimaryAccess(): K3sNodeAccess {
  const target = { id: 'server', kind: 'local-host', os: 'linux', architecture: 'amd64' } as const;
  return {
    node: { id: target.id, role: 'server', target },
    transport: { kind: 'local' },
  };
}
