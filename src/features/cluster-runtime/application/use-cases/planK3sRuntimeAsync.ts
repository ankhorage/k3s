import type {
  InfraExecutionContext,
  InfraOwnedResource,
  InfraPlanAction,
  InfraResult,
} from '@ankhorage/contracts/infra';
import { createKubernetesDriver, projectKubernetesResourcesAsync } from '@ankhorage/kubernetes';

import type {
  K3sClusterObservation,
  K3sDesiredState,
  K3sNodeObservation,
  K3sRuntimeDependencies,
} from '../../../../types/k3sRuntime';
import { createK3sClusterOwner, createK3sNodeOwner } from '../../utils/createK3sOwners';
import { createKubernetesDriverRequest } from '../../utils/createKubernetesDriverRequest';
import { prepareK3sRuntimeAsync } from './prepareK3sRuntimeAsync';

/*** Plan k3s nodes, cluster and standard Kubernetes resources without mutation. */
export async function planK3sRuntimeAsync(
  options: K3sRuntimeDependencies,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): Promise<InfraResult<readonly InfraPlanAction[]>> {
  const prepared = await prepareK3sRuntimeAsync(options, context, desired);
  if (!prepared.ok) return prepared;
  const { spec, access } = prepared.value;
  const observed = await options.controlPlane.inspectAsync(spec, access, context.signal);
  if (!observed.ok) return observed;
  const nodeOwners = spec.nodes.map(({ id }) => createK3sNodeOwner(context, spec, id));
  const clusterOwner = createK3sClusterOwner(context, spec, nodeOwners);
  const nodeActions = createNodeActions(nodeOwners, clusterOwner, observed.value);
  const clusterAction = createClusterAction(clusterOwner, observed.value);
  const request = createKubernetesDriverRequest(context, desired);
  if (observed.value.api === undefined && observed.value.state !== 'absent') {
    return missingPlanAccess();
  }
  const workloads = observed.value.api
    ? await createKubernetesDriver({ api: observed.value.api }).planAsync(request)
    : await createPreClusterPlanAsync(request, clusterOwner.identity);
  if (!workloads.ok) return workloads;
  return {
    ok: true,
    value: [
      ...nodeActions,
      clusterAction,
      ...workloads.value.map((action) => linkRootAction(action, clusterOwner.identity)),
    ],
    diagnostics: [],
  };
}

function createNodeActions(
  owners: readonly InfraOwnedResource[],
  cluster: InfraOwnedResource,
  observed: K3sClusterObservation,
): readonly InfraPlanAction[] {
  const actual = new Map(observed.nodes.map((node) => [node.id, node]));
  const desiredIds = new Set(
    owners.map(({ identity }) => identity.resourceId.slice('node:'.length)),
  );
  const desired = owners.map((owner) =>
    createNodeAction(owner, actual.get(owner.identity.resourceId.slice('node:'.length))),
  );
  const stale = observed.nodes
    .filter(({ id }) => !desiredIds.has(id))
    .map((node) => ({
      owner: { ...cluster.identity, resourceId: `node:${node.id}` },
      operation: 'delete' as const,
      impact: 'interrupts-service' as const,
      detail: `k3s node ${node.id}: delete.`,
      dependsOn: [],
    }));
  return [...desired, ...stale];
}

function createNodeAction(
  owner: InfraOwnedResource,
  observed: K3sNodeObservation | undefined,
): InfraPlanAction {
  const operation =
    observed === undefined || observed.state === 'absent'
      ? 'create'
      : observed.configurationMatches
        ? 'noop'
        : 'update';
  return {
    owner: owner.identity,
    operation,
    impact: operation === 'update' ? 'interrupts-service' : 'none',
    detail: `k3s node ${owner.identity.resourceId.slice('node:'.length)}: ${operation}.`,
    dependsOn: [],
  };
}

function createClusterAction(
  owner: InfraOwnedResource,
  observed: K3sClusterObservation,
): InfraPlanAction {
  const operation =
    observed.state === 'absent'
      ? 'create'
      : observed.state === 'ready' && observed.configurationMatches
        ? 'noop'
        : 'update';
  return {
    owner: owner.identity,
    operation,
    impact: operation === 'update' ? 'interrupts-service' : 'none',
    detail: `k3s cluster ${owner.externalId}: ${operation}.`,
    dependsOn: owner.dependsOn,
  };
}

function missingPlanAccess(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'k3s-plan-access-required',
        message: 'k3s must be running so existing Kubernetes resources can be planned safely.',
      },
    ],
  };
}

async function createPreClusterPlanAsync(
  request: Parameters<typeof projectKubernetesResourcesAsync>[0],
  cluster: InfraPlanAction['owner'],
): Promise<InfraResult<readonly InfraPlanAction[]>> {
  const projection = await projectKubernetesResourcesAsync(request);
  if (!projection.ok) return projection;
  return {
    ok: true,
    value: projection.value.resources.map(({ owner }) => ({
      owner: owner.identity,
      operation: 'create',
      impact: 'none',
      detail: `Kubernetes resource ${owner.identity.resourceId}: create.`,
      dependsOn: owner.dependsOn.length === 0 ? [cluster] : owner.dependsOn,
    })),
    diagnostics: [],
  };
}

function linkRootAction(
  action: InfraPlanAction,
  cluster: InfraPlanAction['owner'],
): InfraPlanAction {
  return action.dependsOn.length === 0 ? { ...action, dependsOn: [cluster] } : action;
}
