import type {
  InfraDestroyRequest,
  InfraExecutionContext,
  InfraReconcileResult,
  InfraResult,
} from '@ankhorage/contracts/infra';
import { createKubernetesDriver } from '@ankhorage/kubernetes';

import type { K3sDesiredState, K3sRuntimeDependencies } from '../../../../types/k3sRuntime';
import { createK3sClusterOwner, createK3sNodeOwner } from '../../utils/createK3sOwners';
import { prepareK3sRuntimeAsync } from './prepareK3sRuntimeAsync';

/*** Remove workloads before k3s, retaining the cluster whenever persistent data survives. */
export async function destroyK3sRuntimeAsync(
  options: K3sRuntimeDependencies,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
  request: InfraDestroyRequest,
): Promise<InfraResult<InfraReconcileResult>> {
  if (!isConfirmed(context, request)) return unconfirmedDestroy();
  const prepared = await prepareK3sRuntimeAsync(options, context, desired);
  if (!prepared.ok) return prepared;
  const { spec, access } = prepared.value;
  const observed = await options.controlPlane.inspectAsync(spec, access, context.signal);
  if (!observed.ok) return observed;
  if (observed.value.state === 'absent') {
    return { ok: true, value: { resources: [], outputs: [] }, diagnostics: [] };
  }
  if (observed.value.api === undefined) return missingDestroyAccess();
  const nodes = observed.value.nodes.map(({ id }) => createK3sNodeOwner(context, spec, id));
  const cluster = createK3sClusterOwner(context, spec, nodes);
  const removed = await createKubernetesDriver({ api: observed.value.api }).removeAsync(
    {
      context,
      ownerAdapter: 'k3s',
      workloads: desired.workloads,
      availableOutputs: desired.availableOutputs,
    },
    request,
  );
  if (!removed.ok) return removed;
  if (removed.value.resources.length > 0) {
    return {
      ok: true,
      value: { resources: [...nodes, cluster, ...removed.value.resources], outputs: [] },
      diagnostics: [],
    };
  }
  const destroyed = await options.controlPlane.destroyAsync(spec, access, context.signal);
  return destroyed.ok
    ? { ok: true, value: { resources: [], outputs: [] }, diagnostics: [] }
    : destroyed;
}

function missingDestroyAccess(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'k3s-destroy-access-required',
        message: 'k3s must be running so retained Kubernetes resources can be verified.',
      },
    ],
  };
}

function isConfirmed(context: InfraExecutionContext, request: InfraDestroyRequest): boolean {
  return (
    request.projectId === context.projectId &&
    request.environment === context.environment &&
    request.confirmation.projectId === context.projectId &&
    request.confirmation.environment === context.environment
  );
}

function unconfirmedDestroy(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'k3s-destroy-unconfirmed',
        message: 'k3s destroy requires exact project and environment confirmation.',
      },
    ],
  };
}
