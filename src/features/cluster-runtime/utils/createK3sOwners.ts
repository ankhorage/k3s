import type { InfraExecutionContext, InfraOwnedResource } from '@ankhorage/contracts/infra';

import type { K3sClusterIdentity } from '../../../types/k3sRuntime';

/** Create ownership records for one k3s node. */
export function createK3sNodeOwner(
  context: InfraExecutionContext,
  cluster: K3sClusterIdentity,
  nodeId: string,
): InfraOwnedResource {
  return {
    identity: {
      projectId: context.projectId,
      environment: context.environment,
      adapter: 'k3s',
      resourceId: `node:${nodeId}`,
    },
    externalId: `${cluster.name}:${nodeId}`,
    persistent: false,
    retention: 'delete-on-destroy',
    dependsOn: [],
  };
}

/** Create cluster ownership linked to every desired k3s node. */
export function createK3sClusterOwner(
  context: InfraExecutionContext,
  cluster: K3sClusterIdentity,
  nodes: readonly InfraOwnedResource[],
): InfraOwnedResource {
  return {
    identity: {
      projectId: context.projectId,
      environment: context.environment,
      adapter: 'k3s',
      resourceId: 'cluster',
    },
    externalId: cluster.name,
    persistent: false,
    retention: 'retain',
    dependsOn: nodes.map(({ identity }) => identity),
  };
}
