import type { InfraResult } from '@ankhorage/contracts/infra';
import { isRecord } from '@ankhorage/utility/object';

import type {
  K3sClusterSpec,
  K3sNetworkingObservation,
  K3sNodeAccess,
} from '../../../types/k3sRuntime';
import { createK3sTraefikConfigResource } from '../utils/createK3sTraefikConfigResource';
import { commandFailed, K3S_BINARY, type K3sCliContext, success } from './k3sCliSupport';

const TRAEFIK_CONFIG_RESOURCE = 'helmchartconfig.helm.cattle.io/traefik';
const TRAEFIK_NAMESPACE = 'kube-system';

/** Inspect the owned Traefik TLS configuration without mutating cluster state. */
export async function inspectK3sNetworkingAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  primary: K3sNodeAccess,
  signal?: AbortSignal,
): Promise<InfraResult<K3sNetworkingObservation>> {
  const result = await context.executor.runAsync(primary, {
    executable: K3S_BINARY,
    arguments: [
      'kubectl',
      'get',
      TRAEFIK_CONFIG_RESOURCE,
      '--namespace',
      TRAEFIK_NAMESPACE,
      '--ignore-not-found=true',
      '--output=json',
    ],
    ...(signal === undefined ? {} : { signal }),
  });
  if (result.exitCode !== 0) return commandFailed('k3s-networking-inspection-failed');
  if (result.stdout.trim().length === 0) {
    return success({
      state: 'absent',
      configurationMatches: createK3sTraefikConfigResource(spec) === undefined,
    });
  }
  const actual = parseResource(result.stdout);
  if (actual === undefined) return commandFailed('k3s-networking-inspection-invalid');
  const owned = isOwnedByCluster(actual, spec);
  const desired = createK3sTraefikConfigResource(spec);
  const desiredValuesContent = desired?.spec?.valuesContent;
  return success({
    state: owned ? 'owned' : 'foreign',
    configurationMatches:
      desired === undefined
        ? !owned
        : owned &&
          typeof desiredValuesContent === 'string' &&
          readValuesContent(actual) === desiredValuesContent,
  });
}

/** Parse one kubectl JSON object without trusting its external shape. */
function parseResource(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Check exact Infra ownership before k3s may mutate the singleton Traefik configuration. */
function isOwnedByCluster(resource: Record<string, unknown>, spec: K3sClusterSpec): boolean {
  const metadata = resource.metadata;
  if (!isRecord(metadata) || !isRecord(metadata.labels)) return false;
  return (
    metadata.labels['app.kubernetes.io/managed-by'] === 'ankhorage-infra' &&
    metadata.labels['infra.ankhorage.dev/project'] === spec.projectId &&
    metadata.labels['infra.ankhorage.dev/environment'] === spec.environment
  );
}

/** Read the one Traefik chart value controlled by this runtime slice. */
function readValuesContent(resource: Record<string, unknown>): string | undefined {
  const spec = resource.spec;
  return isRecord(spec) && typeof spec.valuesContent === 'string' ? spec.valuesContent : undefined;
}
