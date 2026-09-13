import type { InfraRuntimeAdapter } from '@ankhorage/contracts/infra';

import { infraAdapterDescriptor } from '../../../constants/infra';
import type { K3sAdapterOptions } from '../../../types/k3sRuntime';
import { destroyK3sRuntimeAsync } from '../application/use-cases/destroyK3sRuntimeAsync';
import { ensureK3sRuntimeAsync } from '../application/use-cases/ensureK3sRuntimeAsync';
import { getK3sStatusAsync } from '../application/use-cases/getK3sStatusAsync';
import { planK3sRuntimeAsync } from '../application/use-cases/planK3sRuntimeAsync';
import { suspendK3sRuntimeAsync } from '../application/use-cases/suspendK3sRuntimeAsync';
import { validateK3sRuntimeAsync } from '../application/use-cases/validateK3sRuntimeAsync';

/***
 * Create the canonical k3s runtime adapter entrypoint.
 *
 * The caller supplies a k3s-specific control-plane boundary. Standard workload projection and
 * reconciliation are delegated to the published Kubernetes driver.
 *
 * @readme
 */
export function createInfraAdapter(options: K3sAdapterOptions): InfraRuntimeAdapter<'k3s'> {
  return {
    descriptor: infraAdapterDescriptor,
    validateAsync: (context, desired) => validateK3sRuntimeAsync(options, context, desired),
    planAsync: (context, desired) => planK3sRuntimeAsync(options, context, desired),
    ensureAsync: (context, desired) => ensureK3sRuntimeAsync(options, context, desired),
    statusAsync: (context) => getK3sStatusAsync(options, context),
    suspendAsync: (context) => suspendK3sRuntimeAsync(options, context),
    destroyAsync: (context, request) => destroyK3sRuntimeAsync(options, context, request),
  };
}
