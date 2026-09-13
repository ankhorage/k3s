import type { InfraExecutionContext, InfraResult } from '@ankhorage/contracts/infra';

import type {
  K3sClusterSpec,
  K3sDesiredState,
  K3sNodeAccess,
  K3sRuntimeDependencies,
} from '../../../../types/k3sRuntime';
import { getK3sClusterSpec } from '../../utils/getK3sClusterSpec';
import { resolveK3sNodeAccessAsync } from '../../utils/resolveK3sNodeAccessAsync';

interface PreparedK3sRuntime {
  readonly spec: K3sClusterSpec;
  readonly access: readonly K3sNodeAccess[];
}

/** Resolve transient access and validate k3s control-plane prerequisites. */
export async function prepareK3sRuntimeAsync(
  options: K3sRuntimeDependencies,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): Promise<InfraResult<PreparedK3sRuntime>> {
  const spec = getK3sClusterSpec(context, desired);
  if (!spec.ok) return spec;
  const access = await resolveK3sNodeAccessAsync(context, spec.value);
  if (!access.ok) return access;
  const validation = await options.controlPlane.validateAsync(
    spec.value,
    access.value,
    context.signal,
  );
  if (!validation.ok) return validation;
  return { ok: true, value: { spec: spec.value, access: access.value }, diagnostics: [] };
}
