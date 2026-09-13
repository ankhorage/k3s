import type {
  InfraExecutionContext,
  InfraResourceStatus,
  InfraResult,
} from '@ankhorage/contracts/infra';
import { createKubernetesDriver } from '@ankhorage/kubernetes';

import type { K3sDesiredState, K3sRuntimeDependencies } from '../../../../types/k3sRuntime';
import { createK3sClusterOwner, createK3sNodeOwner } from '../../utils/createK3sOwners';
import { prepareK3sRuntimeAsync } from './prepareK3sRuntimeAsync';

/*** Aggregate k3s node, cluster and owned Kubernetes workload status. */
export async function getK3sStatusAsync(
  options: K3sRuntimeDependencies,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): Promise<InfraResult<readonly InfraResourceStatus[]>> {
  const prepared = await prepareK3sRuntimeAsync(options, context, desired);
  if (!prepared.ok) return prepared;
  const { spec, access } = prepared.value;
  const observed = await options.controlPlane.inspectAsync(spec, access, context.signal);
  if (!observed.ok) return observed;
  const nodes = observed.value.nodes.map((node) => createK3sNodeOwner(context, spec, node.id));
  const cluster = createK3sClusterOwner(context, spec, nodes);
  const nodeStatuses: InfraResourceStatus[] = observed.value.nodes.map((node) => {
    const owner = createK3sNodeOwner(context, spec, node.id);
    return {
      owner: owner.identity,
      state: node.state,
      ...(node.detail === undefined ? {} : { detail: node.detail }),
    };
  });
  const clusterStatus: InfraResourceStatus = {
    owner: cluster.identity,
    state: observed.value.state,
    ...(observed.value.detail === undefined ? {} : { detail: observed.value.detail }),
  };
  if (observed.value.api === undefined) {
    return { ok: true, value: [...nodeStatuses, clusterStatus], diagnostics: [] };
  }
  const workloads = await createKubernetesDriver({ api: observed.value.api }).statusAsync({
    context,
    ownerAdapter: 'k3s',
    workloads: desired.workloads,
    availableOutputs: desired.availableOutputs,
  });
  if (!workloads.ok) return workloads;
  return {
    ok: true,
    value: [...nodeStatuses, clusterStatus, ...workloads.value],
    diagnostics: [],
  };
}
