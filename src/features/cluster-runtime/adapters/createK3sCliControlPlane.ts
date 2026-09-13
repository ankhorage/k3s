import type { K3sCliControlPlaneOptions, K3sControlPlane } from '../../../types/k3sRuntime';
import { createK3sNodeCommandExecutor } from './createK3sNodeCommandExecutor';
import { inspectK3sCliAsync, validateK3sCliAsync } from './inspectK3sCliAsync';
import {
  assertNonNegativeInteger,
  assertPositiveInteger,
  type K3sCliContext,
  loadOfficialInstallScriptAsync,
} from './k3sCliSupport';
import {
  destroyK3sCliAsync,
  ensureK3sCliAsync,
  loadK3sImagesAsync,
  suspendK3sCliAsync,
  waitForK3sCliAsync,
} from './operateK3sCliAsync';

/** Create the concrete stateless k3s control plane for local Linux and verified SSH targets. */
export function createK3sCliControlPlane(options: K3sCliControlPlaneOptions = {}): K3sControlPlane {
  const context: K3sCliContext = {
    executor: options.executor ?? createK3sNodeCommandExecutor(),
    installScriptLoader: options.installScriptLoader ?? loadOfficialInstallScriptAsync,
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
    readinessTimeoutSeconds: options.readinessTimeoutSeconds ?? 180,
  };
  assertNonNegativeInteger('pollIntervalMs', context.pollIntervalMs);
  assertPositiveInteger('readinessTimeoutSeconds', context.readinessTimeoutSeconds);
  return {
    validateAsync: (spec, access, signal) => validateK3sCliAsync(context, spec, access, signal),
    inspectAsync: (spec, access, signal) => inspectK3sCliAsync(context, spec, access, signal),
    ensureAsync: (spec, access, signal) => ensureK3sCliAsync(context, spec, access, signal),
    waitUntilReadyAsync: (spec, access, signal) =>
      waitForK3sCliAsync(context, spec, access, signal),
    loadImagesAsync: (spec, access, images, signal) =>
      loadK3sImagesAsync(context, spec, access, images, signal),
    suspendAsync: (spec, access, signal) => suspendK3sCliAsync(context, spec, access, signal),
    destroyAsync: (spec, access, signal) => destroyK3sCliAsync(context, spec, access, signal),
  };
}
