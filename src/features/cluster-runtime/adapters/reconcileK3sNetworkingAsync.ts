import type { InfraResult } from '@ankhorage/contracts/infra';

import type { K3sClusterSpec, K3sNodeAccess } from '../../../types/k3sRuntime';
import { createK3sTraefikConfigResource } from '../utils/createK3sTraefikConfigResource';
import { inspectK3sNetworkingAsync } from './inspectK3sNetworkingAsync';
import { K3S_BINARY, type K3sCliContext, runNodeCommandAsync, success } from './k3sCliSupport';

const TRAEFIK_CONFIG_RESOURCE = 'helmchartconfig.helm.cattle.io/traefik';
const TRAEFIK_NAMESPACE = 'kube-system';

/** Reconcile only the k3s-owned Traefik TLS configuration and preserve foreign configuration. */
export async function reconcileK3sNetworkingAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  primary: K3sNodeAccess,
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  const observed = await inspectK3sNetworkingAsync(context, spec, primary, signal);
  if (!observed.ok) return observed;
  const desired = createK3sTraefikConfigResource(spec);
  if (desired === undefined) {
    if (observed.value.state !== 'owned') return success(null);
    return runNodeCommandAsync(
      context,
      primary,
      K3S_BINARY,
      [
        'kubectl',
        'delete',
        TRAEFIK_CONFIG_RESOURCE,
        '--namespace',
        TRAEFIK_NAMESPACE,
        '--ignore-not-found=true',
      ],
      signal,
    );
  }
  if (observed.value.state === 'foreign') return foreignTraefikConfig();
  if (observed.value.configurationMatches) return success(null);
  const applied = await runNodeCommandAsync(
    context,
    primary,
    K3S_BINARY,
    ['kubectl', 'apply', '-f', '-'],
    signal,
    JSON.stringify(desired),
  );
  if (!applied.ok) return applied;
  return runNodeCommandAsync(
    context,
    primary,
    K3S_BINARY,
    [
      'kubectl',
      'rollout',
      'status',
      'deployment/traefik',
      '--namespace',
      TRAEFIK_NAMESPACE,
      `--timeout=${context.readinessTimeoutSeconds}s`,
    ],
    signal,
  );
}

/** Refuse to overwrite a singleton Traefik HelmChartConfig not owned by this Infra environment. */
function foreignTraefikConfig(): InfraResult<never> {
  return {
    ok: false,
    diagnostics: [
      {
        severity: 'error',
        code: 'k3s-traefik-config-conflict',
        message:
          'Automatic TLS requires HelmChartConfig/traefik, but the existing resource is not owned by this Infra environment.',
      },
    ],
  };
}
