import type { InfraResourceStatus, InfraResult } from '@ankhorage/contracts/infra';
import { createKubectlKubernetesApi, type KubernetesCommandRunner } from '@ankhorage/kubernetes';

import type {
  K3sClusterObservation,
  K3sClusterSpec,
  K3sNodeAccess,
  K3sNodeCommandExecutor,
  K3sNodeObservation,
} from '../../../types/k3sRuntime';
import {
  commandFailed,
  invalidAccess,
  invalidLocalTopology,
  K3S_BINARY,
  type K3sCliContext,
  success,
} from './k3sCliSupport';

export async function validateK3sCliAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<null>> {
  if (!hasExactAccess(spec, access)) return invalidAccess();
  if (access.some(({ transport }) => transport.kind === 'local') && access.length !== 1) {
    return invalidLocalTopology();
  }
  for (const node of access) {
    const prerequisites = await context.executor.runAsync(node, {
      executable: 'sh',
      arguments: [
        '-c',
        'command -v curl >/dev/null && command -v sh >/dev/null && command -v systemctl >/dev/null',
      ],
      ...(signal === undefined ? {} : { signal }),
    });
    if (prerequisites.exitCode !== 0) return commandFailed('k3s-prerequisites-missing');
  }
  return success(null);
}

export async function inspectK3sCliAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  access: readonly K3sNodeAccess[],
  signal?: AbortSignal,
): Promise<InfraResult<K3sClusterObservation>> {
  if (!hasExactAccess(spec, access)) return invalidAccess();
  const nodes: K3sNodeObservation[] = [];
  for (const node of access) {
    const observation = await inspectNodeAsync(context, spec, node, signal);
    if (!observation.ok) return observation;
    nodes.push(observation.value);
  }
  const state = aggregateState(nodes);
  const primary = access.find(({ node }) => node.role === 'server');
  return success({
    state,
    configurationMatches: nodes.every(({ configurationMatches }) => configurationMatches),
    nodes,
    ...(state === 'ready' && primary !== undefined
      ? { api: createK3sKubernetesApi(context.executor, primary) }
      : {}),
  });
}

async function inspectNodeAsync(
  context: K3sCliContext,
  spec: K3sClusterSpec,
  node: K3sNodeAccess,
  signal?: AbortSignal,
): Promise<InfraResult<K3sNodeObservation>> {
  const service = node.node.role === 'server' ? 'k3s' : 'k3s-agent';
  const active = await context.executor.runAsync(node, {
    executable: 'systemctl',
    arguments: ['is-active', service],
    ...(signal === undefined ? {} : { signal }),
  });
  if (active.exitCode === 0 || isInactiveService(active.stdout)) {
    return success({
      id: node.node.id,
      state: active.exitCode === 0 ? 'ready' : 'stopped',
      configurationMatches: await versionMatchesAsync(context, node, spec, signal),
    });
  }
  const installed = await isK3sInstalledAsync(context, node, signal);
  if (!installed.ok) return installed;
  return success({
    id: node.node.id,
    state: installed.value ? 'stopped' : 'absent',
    configurationMatches:
      installed.value && (await versionMatchesAsync(context, node, spec, signal)),
  });
}

export async function isK3sInstalledAsync(
  context: K3sCliContext,
  access: K3sNodeAccess,
  signal?: AbortSignal,
): Promise<InfraResult<boolean>> {
  const result = await context.executor.runAsync(access, {
    executable: 'sh',
    arguments: ['-c', `test -x ${K3S_BINARY}`],
    ...(signal === undefined ? {} : { signal }),
  });
  return result.exitCode === 0 || result.exitCode === 1
    ? success(result.exitCode === 0)
    : commandFailed('k3s-inspection-failed');
}

export async function versionMatchesAsync(
  context: K3sCliContext,
  access: K3sNodeAccess,
  spec: K3sClusterSpec,
  signal?: AbortSignal,
): Promise<boolean> {
  if (spec.version === undefined) return true;
  const result = await context.executor.runAsync(access, {
    executable: K3S_BINARY,
    arguments: ['--version'],
    ...(signal === undefined ? {} : { signal }),
  });
  return result.exitCode === 0 && result.stdout.includes(spec.version.replace(/^v/, ''));
}

function createK3sKubernetesApi(executor: K3sNodeCommandExecutor, primary: K3sNodeAccess) {
  const runner: KubernetesCommandRunner = {
    runAsync: (request) =>
      executor.runAsync(primary, {
        executable: K3S_BINARY,
        arguments: ['kubectl', ...request.arguments],
        ...(request.stdin === undefined ? {} : { stdin: request.stdin }),
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      }),
  };
  return createKubectlKubernetesApi({ context: 'default', executable: K3S_BINARY, runner });
}

function aggregateState(nodes: readonly K3sNodeObservation[]): InfraResourceStatus['state'] {
  if (nodes.every(({ state }) => state === 'absent')) return 'absent';
  if (nodes.every(({ state }) => state === 'ready')) return 'ready';
  if (nodes.every(({ state }) => state === 'stopped' || state === 'absent')) return 'stopped';
  return 'degraded';
}

function isInactiveService(stdout: string): boolean {
  return ['inactive', 'failed', 'deactivating'].includes(stdout.trim());
}

function hasExactAccess(spec: K3sClusterSpec, access: readonly K3sNodeAccess[]): boolean {
  return (
    access.length === spec.nodes.length &&
    access.every((entry, index) => entry.node.id === spec.nodes.at(index)?.id)
  );
}
