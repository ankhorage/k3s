/** Public k3s runtime adapter package boundary. */
export { infraAdapterDescriptor } from './constants/infra';
export { createInfraAdapter } from './features/cluster-runtime/composition/createInfraAdapter';
export type {
  K3sAdapterOptions,
  K3sClusterIdentity,
  K3sClusterObservation,
  K3sClusterSpec,
  K3sControlPlane,
  K3sDesiredState,
  K3sNodeAccess,
  K3sNodeObservation,
  K3sNodeSpec,
  K3sTopology,
} from './types/k3sRuntime';
