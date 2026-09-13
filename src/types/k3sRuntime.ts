import type {
  InfraComputeTarget,
  InfraExecutionContext,
  InfraResourceStatus,
  InfraResult,
  InfraRuntimeDesiredState,
} from '@ankhorage/contracts/infra';
import type { KubernetesApi } from '@ankhorage/kubernetes';

export interface K3sAdapterOptions {
  readonly controlPlane: K3sControlPlane;
}

export interface K3sClusterIdentity {
  readonly projectId: string;
  readonly environment: InfraExecutionContext['environment'];
  readonly name: string;
}

export interface K3sTopology {
  readonly servers: number;
  readonly agents: number;
}

export interface K3sNodeSpec {
  readonly id: string;
  readonly role: 'server' | 'agent';
  readonly target: InfraComputeTarget;
}

export interface K3sClusterSpec extends K3sClusterIdentity {
  readonly version?: string;
  readonly topology: K3sTopology;
  readonly nodes: readonly K3sNodeSpec[];
}

/** Resolved credentials exist only in calls across this execution boundary. */
export type K3sNodeAccess =
  | {
      readonly node: K3sNodeSpec;
      readonly transport: { readonly kind: 'local' };
    }
  | {
      readonly node: K3sNodeSpec;
      readonly transport: {
        readonly kind: 'ssh';
        readonly host: string;
        readonly port: number;
        readonly user: string;
        readonly hostKeyFingerprint: string;
        readonly credential: Readonly<Record<string, string>>;
      };
    };

export interface K3sNodeObservation {
  readonly id: string;
  readonly state: InfraResourceStatus['state'];
  readonly configurationMatches: boolean;
  readonly detail?: string;
}

export interface K3sClusterObservation {
  readonly state: InfraResourceStatus['state'];
  readonly configurationMatches: boolean;
  readonly nodes: readonly K3sNodeObservation[];
  readonly api?: KubernetesApi;
  readonly detail?: string;
}

/** k3s-specific command boundary for local and authenticated SSH operations. */
export interface K3sControlPlane {
  validateAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  inspectAsync(
    identity: K3sClusterIdentity,
    signal?: AbortSignal,
  ): Promise<InfraResult<K3sClusterObservation>>;
  ensureAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<K3sClusterObservation>>;
  waitUntilReadyAsync(
    identity: K3sClusterIdentity,
    signal?: AbortSignal,
  ): Promise<InfraResult<K3sClusterObservation>>;
  loadImagesAsync(
    identity: K3sClusterIdentity,
    images: readonly string[],
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  suspendAsync(identity: K3sClusterIdentity, signal?: AbortSignal): Promise<InfraResult<null>>;
  destroyAsync(identity: K3sClusterIdentity, signal?: AbortSignal): Promise<InfraResult<null>>;
}

export type K3sDesiredState = InfraRuntimeDesiredState<'k3s'>;
