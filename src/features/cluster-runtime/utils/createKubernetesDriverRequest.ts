import type { InfraExecutionContext } from '@ankhorage/contracts/infra';
import type { KubernetesDriverRequest } from '@ankhorage/kubernetes';

import type { K3sDesiredState } from '../../../types/k3sRuntime';

/** Map k3s desired state to the shared Kubernetes driver boundary. */
export function createKubernetesDriverRequest(
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): KubernetesDriverRequest {
  return {
    context,
    ownerAdapter: 'k3s',
    workloads: desired.workloads,
    availableOutputs: desired.availableOutputs,
  };
}
