import type { InfraResult } from '@ankhorage/contracts/infra';

import type { K3sNodeAccess, K3sNodeCommandExecutor } from '../../../types/k3sRuntime';

const K3S_INSTALL_URL = 'https://get.k3s.io';
export const K3S_BINARY = '/usr/local/bin/k3s';

export interface K3sCliContext {
  readonly executor: K3sNodeCommandExecutor;
  readonly installScriptLoader: (signal?: AbortSignal) => Promise<string>;
  readonly pollIntervalMs: number;
  readonly readinessTimeoutSeconds: number;
}

export async function runNodeCommandAsync(
  context: K3sCliContext,
  access: K3sNodeAccess,
  executable: string,
  arguments_: readonly string[],
  signal?: AbortSignal,
  stdin?: string,
  environment?: Readonly<Record<string, string>>,
): Promise<InfraResult<null>> {
  const result = await context.executor.runAsync(access, {
    executable,
    arguments: arguments_,
    ...(stdin === undefined ? {} : { stdin }),
    ...(environment === undefined ? {} : { environment }),
    ...(signal === undefined ? {} : { signal }),
  });
  return result.exitCode === 0 ? success(null) : commandFailed('k3s-command-failed');
}

export async function loadOfficialInstallScriptAsync(signal?: AbortSignal): Promise<string> {
  const response = await fetch(K3S_INSTALL_URL, signal === undefined ? {} : { signal });
  if (!response.ok) throw new Error('Unable to download the official k3s installer.');
  return response.text();
}

export function delayAsync(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (milliseconds === 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(
          signal.reason instanceof Error ? signal.reason : new Error('k3s operation aborted.'),
        );
      },
      { once: true },
    );
  });
}

export function success<T>(value: T): InfraResult<T> {
  return { ok: true, value, diagnostics: [] };
}

export function invalidAccess(): InfraResult<never> {
  return failure(
    'k3s-access-invalid',
    'k3s requires exact transient access for every desired node.',
  );
}

export function invalidLocalTopology(): InfraResult<never> {
  return failure('k3s-local-topology-invalid', 'Local k3s supports exactly one server node.');
}

export function readinessTimeout(): InfraResult<never> {
  return failure('k3s-readiness-timeout', 'Timed out waiting for the k3s cluster to become ready.');
}

export function commandFailed(code: string): InfraResult<never> {
  return failure(code, 'k3s control-plane command failed.');
}

function failure(code: string, message: string): InfraResult<never> {
  return { ok: false, diagnostics: [{ severity: 'error', code, message }] };
}

export function assertNonNegativeInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0)
    throw new TypeError(`k3s ${name} must be non-negative.`);
}

export function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`k3s ${name} must be positive.`);
}
