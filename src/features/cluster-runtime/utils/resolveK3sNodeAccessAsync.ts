import type { InfraExecutionContext, InfraResult } from '@ankhorage/contracts/infra';

import type { K3sClusterSpec, K3sNodeAccess } from '../../../types/k3sRuntime';

/** Resolve SSH bootstrap credentials at execution time without returning them as lifecycle state. */
export async function resolveK3sNodeAccessAsync(
  context: InfraExecutionContext,
  spec: K3sClusterSpec,
): Promise<InfraResult<readonly K3sNodeAccess[]>> {
  const access: K3sNodeAccess[] = [];
  for (const node of spec.nodes) {
    if (node.target.kind === 'local-host') {
      access.push({ node, transport: { kind: 'local' } });
      continue;
    }
    const credential = await context.credentials.resolveAsync(node.target.credential);
    if (!credential.ok) return credential;
    access.push({
      node,
      transport: {
        kind: 'ssh',
        host: node.target.host,
        port: node.target.port,
        user: node.target.user,
        hostKeyFingerprint: node.target.hostKeyFingerprint,
        credential: credential.value,
      },
    });
  }
  return { ok: true, value: access, diagnostics: [] };
}
