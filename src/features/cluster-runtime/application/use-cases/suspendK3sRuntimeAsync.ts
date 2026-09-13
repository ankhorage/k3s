import type {
  InfraExecutionContext,
  InfraReconcileResult,
  InfraResult,
} from '@ankhorage/contracts/infra';

import type { K3sAdapterOptions } from '../../../../types/k3sRuntime';
import { createK3sClusterOwner, createK3sNodeOwner } from '../../utils/createK3sOwners';
import { getK3sClusterIdentity } from '../../utils/getK3sClusterIdentity';

/*** Stop k3s nodes while preserving the cluster and persistent workload data. */
export async function suspendK3sRuntimeAsync(
  options: K3sAdapterOptions,
  context: InfraExecutionContext,
): Promise<InfraResult<InfraReconcileResult>> {
  const identity = getK3sClusterIdentity(context);
  if (!identity.ok) return identity;
  const observed = await options.controlPlane.inspectAsync(identity.value, context.signal);
  if (!observed.ok) return observed;
  const suspended = await options.controlPlane.suspendAsync(identity.value, context.signal);
  if (!suspended.ok) return suspended;
  const nodes = observed.value.nodes.map(({ id }) =>
    createK3sNodeOwner(context, identity.value, id),
  );
  return {
    ok: true,
    value: {
      resources: [...nodes, createK3sClusterOwner(context, identity.value, nodes)],
      outputs: [],
    },
    diagnostics: [],
  };
}
