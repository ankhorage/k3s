import type { InfraExecutionContext, InfraResult } from '@ankhorage/contracts/infra';

import type { K3sClusterSpec, K3sDesiredState, K3sTopology } from '../../../types/k3sRuntime';
import { getK3sClusterIdentity } from './getK3sClusterIdentity';

/** Validate portable targets and assign deterministic server and agent roles. */
export function getK3sClusterSpec(
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): InfraResult<K3sClusterSpec> {
  const identity = getK3sClusterIdentity(context);
  if (!identity.ok) return identity;
  const topology: K3sTopology = desired.selection.topology ?? { servers: 1, agents: 0 };
  if (!isValidTopology(topology) || desired.targets.length !== topology.servers + topology.agents) {
    return invalidTargets(
      'k3s topology requires positive integer servers, non-negative integer agents, and exactly one target per node.',
    );
  }
  if (desired.targets.some(({ os }) => os !== 'linux')) {
    return invalidTargets('k3s targets must use Linux.');
  }
  if (new Set(desired.targets.map(({ id }) => id)).size !== desired.targets.length) {
    return invalidTargets('k3s target IDs must be unique.');
  }
  return {
    ok: true,
    value: {
      ...identity.value,
      ...(desired.selection.version === undefined ? {} : { version: desired.selection.version }),
      topology,
      nodes: desired.targets.map((target, index) => ({
        id: target.id,
        role: index < topology.servers ? 'server' : 'agent',
        target,
      })),
    },
    diagnostics: [],
  };
}

function isValidTopology(topology: K3sTopology): boolean {
  return (
    Number.isInteger(topology.servers) &&
    topology.servers > 0 &&
    Number.isInteger(topology.agents) &&
    topology.agents >= 0
  );
}

function invalidTargets(message: string): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [{ severity: 'error', code: 'k3s-targets-invalid', message }],
  };
}
