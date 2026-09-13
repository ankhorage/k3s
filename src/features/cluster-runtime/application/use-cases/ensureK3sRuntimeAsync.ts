import type {
  InfraExecutionContext,
  InfraOwnedResource,
  InfraReconcileResult,
  InfraResult,
} from '@ankhorage/contracts/infra';
import { createKubernetesDriver } from '@ankhorage/kubernetes';

import type { K3sAdapterOptions, K3sDesiredState } from '../../../../types/k3sRuntime';
import { createK3sClusterOwner, createK3sNodeOwner } from '../../utils/createK3sOwners';
import { createKubernetesDriverRequest } from '../../utils/createKubernetesDriverRequest';
import { prepareK3sRuntimeAsync } from './prepareK3sRuntimeAsync';

/*** Bootstrap k3s, reconcile workloads through Kubernetes and wait for readiness. */
export async function ensureK3sRuntimeAsync(
  options: K3sAdapterOptions,
  context: InfraExecutionContext,
  desired: K3sDesiredState,
): Promise<InfraResult<InfraReconcileResult>> {
  const prepared = await prepareK3sRuntimeAsync(options, context, desired);
  if (!prepared.ok) return prepared;
  const { spec, access } = prepared.value;
  const ensured = await options.controlPlane.ensureAsync(spec, access, context.signal);
  if (!ensured.ok) return ensured;
  const ready = await options.controlPlane.waitUntilReadyAsync(spec, context.signal);
  if (!ready.ok) return ready;
  if (ready.value.api === undefined) return missingClusterAccess();
  const images = [...new Set(desired.workloads.map(({ artifact }) => artifact.image))].sort();
  const loaded = await options.controlPlane.loadImagesAsync(spec, images, context.signal);
  if (!loaded.ok) return loaded;
  const driver = createKubernetesDriver({ api: ready.value.api });
  const request = createKubernetesDriverRequest(context, desired);
  const reconciled = await driver.reconcileAsync(request);
  if (!reconciled.ok) return reconciled;
  const readiness = await driver.waitUntilReadyAsync(request);
  if (!readiness.ok) return readiness;
  const nodes = spec.nodes.map(({ id }) => createK3sNodeOwner(context, spec, id));
  const cluster = createK3sClusterOwner(context, spec, nodes);
  return {
    ok: true,
    value: {
      resources: [
        ...nodes,
        cluster,
        ...reconciled.value.resources.map((owner) => linkRootOwner(owner, cluster)),
      ],
      outputs: reconciled.value.outputs,
    },
    diagnostics: [],
  };
}

function missingClusterAccess(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'k3s-cluster-access-missing',
        message: 'k3s became ready without authenticated Kubernetes API access.',
      },
    ],
  };
}

function linkRootOwner(owner: InfraOwnedResource, cluster: InfraOwnedResource): InfraOwnedResource {
  return owner.dependsOn.length === 0 ? { ...owner, dependsOn: [cluster.identity] } : owner;
}
