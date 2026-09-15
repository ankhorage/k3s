import type { KubernetesResource } from '@ankhorage/kubernetes';

import type { K3sClusterSpec } from '../../../types/k3sRuntime';

const TRAEFIK_NAMESPACE = 'kube-system';
const TRAEFIK_NAME = 'traefik';
const CERTIFICATE_RESOLVER = 'ankhorage';

/** Create the k3s-owned Traefik HelmChartConfig for canonical ACME HTTP-01 TLS intent. */
export function createK3sTraefikConfigResource(
  spec: K3sClusterSpec,
): KubernetesResource | undefined {
  const tls = spec.networking?.tls;
  if (tls === undefined) return undefined;
  return {
    apiVersion: 'helm.cattle.io/v1',
    kind: 'HelmChartConfig',
    metadata: {
      name: TRAEFIK_NAME,
      namespace: TRAEFIK_NAMESPACE,
      labels: {
        'app.kubernetes.io/managed-by': 'ankhorage-infra',
        'infra.ankhorage.dev/project': spec.projectId,
        'infra.ankhorage.dev/environment': spec.environment,
      },
      annotations: {
        'infra.ankhorage.dev/adapter': 'k3s',
      },
    },
    spec: {
      valuesContent: createValuesContent(tls.contactEmail),
    },
  };
}

/** Render deterministic Traefik chart values without embedding runtime-specific fields in Contracts. */
function createValuesContent(contactEmail: string): string {
  const arguments_ = [
    `--certificatesresolvers.${CERTIFICATE_RESOLVER}.acme.email=${contactEmail}`,
    `--certificatesresolvers.${CERTIFICATE_RESOLVER}.acme.storage=/data/acme.json`,
    `--certificatesresolvers.${CERTIFICATE_RESOLVER}.acme.httpchallenge.entrypoint=web`,
    '--entrypoints.web.http.redirections.entrypoint.to=websecure',
    '--entrypoints.web.http.redirections.entrypoint.scheme=https',
    '--entrypoints.websecure.http.tls=true',
    `--entrypoints.websecure.http.tls.certresolver=${CERTIFICATE_RESOLVER}`,
  ];
  return [
    'additionalArguments:',
    ...arguments_.map((argument) => `  - ${JSON.stringify(argument)}`),
    'persistence:',
    '  enabled: true',
    '  name: data',
    '  path: /data',
    '  size: 128Mi',
    '',
  ].join('\n');
}
