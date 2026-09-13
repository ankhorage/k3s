import type {
  InfraExecutionContext,
  InfraReconcileResult,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { K3sDesiredState, K3sRuntimeDependencies } from '../../../../types/k3sRuntime';
import { createK3sClusterOwner, createK3sNodeOwner } from '../../utils/createK3sOwners';
import { prepareK3sRuntimeAsync } from './prepareK3sRuntimeAsync';

/*** Stop k3s nodes while preserving the cluster and persistent workload data. */
export async function suspendK3sRuntimeAsync(
  options: K3sRuntimeDependencies,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): Promise<InfraResult<InfraReconcileResult>> {
  const prepared = await prepareK3sRuntimeAsync(options, context, desired);
  if (!prepared.ok) return prepared;
  const { spec, access } = prepared.value;
  const observed = await options.controlPlane.inspectAsync(spec, access, context.signal);
  if (!observed.ok) return observed;
  const suspended = await options.controlPlane.suspendAsync(spec, access, context.signal);
  if (!suspended.ok) return suspended;
  const nodes = observed.value.nodes.map(({ id }) => createK3sNodeOwner(context, spec, id));
  return {
    ok: true,
    value: {
      resources: [...nodes, createK3sClusterOwner(context, spec, nodes)],
      outputs: [],
    },
    diagnostics: [],
  };
}
