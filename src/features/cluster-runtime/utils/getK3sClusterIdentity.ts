import type { InfraExecutionContext, InfraResult } from '@ankhorage/contracts/infra';

import type { K3sClusterIdentity } from '../../../types/k3sRuntime';

/** Resolve the active k3s identity from the canonical runtime selection. */
export function getK3sClusterIdentity(
  context: InfraExecutionContext,
): InfraResult<K3sClusterIdentity> {
  if (context.desired.deployment.runtime.provider !== 'k3s') {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'k3s-selection-invalid',
          message: 'k3s requires the canonical k3s runtime selection.',
        },
      ],
    };
  }
  return {
    ok: true,
    value: {
      projectId: context.projectId,
      environment: context.environment,
      name: toClusterName(`${context.projectId}-${context.environment}`),
    },
    diagnostics: [],
  };
}

/** Normalize project identity into a deterministic k3s cluster name. */
function toClusterName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'ankhorage'
  );
}
