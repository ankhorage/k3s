import type { InfraResult } from '@ankhorage/contracts/infra';
import type {
  KubernetesApi,
  KubernetesOwnershipQuery,
  KubernetesResource,
  KubernetesResourceObservation,
  KubernetesResourceReference,
} from '@ankhorage/kubernetes';

import type {
  K3sClusterObservation,
  K3sClusterSpec,
  K3sControlPlane,
  K3sNodeAccess,
} from './index';

/** Generic in-memory boundary fixture for k3s and Kubernetes lifecycle acceptance. */
export class FakeK3sControlPlane implements K3sControlPlane {
  readonly api = new FakeKubernetesApi();
  readonly calls: string[] = [];
  lastAccess: readonly K3sNodeAccess[] = [];
  state: K3sClusterObservation['state'] = 'absent';
  nodes: K3sClusterObservation['nodes'] = [];

  validateAsync(
    _spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
  ): Promise<InfraResult<null>> {
    this.calls.push('validate');
    this.lastAccess = access;
    return success(null);
  }

  inspectAsync(): Promise<InfraResult<K3sClusterObservation>> {
    this.calls.push('inspect');
    return success(this.observation());
  }

  ensureAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
  ): Promise<InfraResult<K3sClusterObservation>> {
    this.calls.push('ensure');
    this.lastAccess = access;
    this.state = 'ready';
    this.nodes = spec.nodes.map(({ id }) => ({
      id,
      state: 'ready',
      configurationMatches: true,
    }));
    return success(this.observation());
  }

  waitUntilReadyAsync(): Promise<InfraResult<K3sClusterObservation>> {
    this.calls.push('wait');
    return success(this.observation());
  }

  loadImagesAsync(
    _spec: K3sClusterSpec,
    _access: readonly K3sNodeAccess[],
    images: readonly string[],
  ): Promise<InfraResult<null>> {
    this.calls.push(`images:${images.join(',')}`);
    return success(null);
  }

  suspendAsync(): Promise<InfraResult<null>> {
    this.calls.push('suspend');
    this.state = 'stopped';
    this.nodes = this.nodes.map((node) => ({ ...node, state: 'stopped' }));
    return success(null);
  }

  destroyAsync(): Promise<InfraResult<null>> {
    this.calls.push('destroy');
    this.state = 'absent';
    this.nodes = [];
    return success(null);
  }

  private observation(): K3sClusterObservation {
    return {
      state: this.state,
      configurationMatches: true,
      nodes: this.nodes,
      ...(this.state === 'ready' ? { api: this.api } : {}),
    };
  }
}

/** Generic Kubernetes API fixture used through the published driver boundary. */
class FakeKubernetesApi implements KubernetesApi {
  readonly resources: KubernetesResource[] = [];

  listOwnedAsync(query: KubernetesOwnershipQuery): Promise<readonly KubernetesResource[]> {
    return Promise.resolve(
      this.resources.filter(({ metadata }) => includesLabels(metadata.labels, query.labels)),
    );
  }

  applyAsync(resource: KubernetesResource): Promise<void> {
    const index = this.resources.findIndex((candidate) => sameResource(candidate, resource));
    if (index === -1) this.resources.push(resource);
    else this.resources.splice(index, 1, resource);
    return Promise.resolve();
  }

  deleteAsync(reference: KubernetesResourceReference): Promise<void> {
    const index = this.resources.findIndex((resource) => sameResource(resource, reference));
    if (index >= 0) this.resources.splice(index, 1);
    return Promise.resolve();
  }

  observeAsync(reference: KubernetesResourceReference): Promise<KubernetesResourceObservation> {
    return Promise.resolve({
      state: 'ready',
      ...(reference.kind === 'Service'
        ? { publicOutputs: { endpoint: 'https://api.sample.test' } }
        : {}),
    });
  }

  waitUntilReadyAsync(): Promise<KubernetesResourceObservation> {
    return Promise.resolve({ state: 'ready' });
  }
}

function success<T>(value: T): Promise<InfraResult<T>> {
  return Promise.resolve({ ok: true, value, diagnostics: [] });
}

function includesLabels(
  actual: Readonly<Record<string, string>>,
  expected: Readonly<Record<string, string>>,
): boolean {
  return Object.entries(expected).every(([expectedKey, expectedValue]) =>
    Object.entries(actual).some(
      ([actualKey, actualValue]) => actualKey === expectedKey && actualValue === expectedValue,
    ),
  );
}

function sameResource(
  left: KubernetesResource,
  right: KubernetesResource | KubernetesResourceReference,
): boolean {
  return (
    left.apiVersion === right.apiVersion &&
    left.kind === right.kind &&
    left.metadata.name === ('metadata' in right ? right.metadata.name : right.name) &&
    left.metadata.namespace === ('metadata' in right ? right.metadata.namespace : right.namespace)
  );
}
