import type {
  InfraComputeTarget,
  InfraExecutionContext,
  InfraResourceStatus,
  InfraResult,
  InfraRuntimeDesiredState,
} from '@ankhorage/contracts/infra';
import type { KubernetesApi } from '@ankhorage/kubernetes';

export interface K3sAdapterOptions {
  readonly controlPlane?: K3sControlPlane;
  readonly cli?: K3sCliControlPlaneOptions;
}

export interface K3sRuntimeDependencies {
  readonly controlPlane: K3sControlPlane;
}

export interface K3sNodeCommandRequest {
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly stdin?: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface K3sNodeCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Execute one argv-safe command on a resolved local or SSH node. */
export interface K3sNodeCommandExecutor {
  runAsync(access: K3sNodeAccess, request: K3sNodeCommandRequest): Promise<K3sNodeCommandResult>;
}

export interface K3sCliControlPlaneOptions {
  readonly executor?: K3sNodeCommandExecutor;
  readonly installScriptLoader?: (signal?: AbortSignal) => Promise<string>;
  readonly pollIntervalMs?: number;
  readonly readinessTimeoutSeconds?: number;
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
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<K3sClusterObservation>>;
  ensureAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<K3sClusterObservation>>;
  waitUntilReadyAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<K3sClusterObservation>>;
  loadImagesAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    images: readonly string[],
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  suspendAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
  destroyAsync(
    spec: K3sClusterSpec,
    access: readonly K3sNodeAccess[],
    signal?: AbortSignal,
  ): Promise<InfraResult<null>>;
}

export type K3sDesiredState = InfraRuntimeDesiredState<'k3s'>;
