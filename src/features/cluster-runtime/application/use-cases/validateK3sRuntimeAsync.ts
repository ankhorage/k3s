import type { InfraExecutionContext, InfraResult } from '@ankhorage/contracts/infra';

import type { K3sAdapterOptions, K3sDesiredState } from '../../../../types/k3sRuntime';
import { prepareK3sRuntimeAsync } from './prepareK3sRuntimeAsync';

/** Validate topology, targets, credentials and control-plane prerequisites without mutation. */
export async function validateK3sRuntimeAsync(
  options: K3sAdapterOptions,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): Promise<InfraResult<null>> {
  const prepared = await prepareK3sRuntimeAsync(options, context, desired);
  return prepared.ok ? { ok: true, value: null, diagnostics: [] } : prepared;
}
