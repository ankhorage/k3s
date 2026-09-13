# Public API

## createInfraAdapter

Kind: `function`
Module: `src/features/cluster-runtime/composition/createInfraAdapter.ts`
Source: `src/features/cluster-runtime/composition/createInfraAdapter.ts:22:1`

Create the canonical k3s runtime adapter entrypoint.

The default composition bootstraps local Linux or host-key-pinned SSH nodes through the official
k3s installer. Standard workload projection and reconciliation are delegated to the published
Kubernetes driver. Tests and specialized hosts may inject the control-plane boundary.

### Signatures

- `(options?: K3sAdapterOptions) => InfraRuntimeAdapter<"k3s">`
  - options: `K3sAdapterOptions` (optional)
  - returns: `InfraRuntimeAdapter<"k3s">`

## createK3sCliControlPlane

Kind: `function`
Module: `src/features/cluster-runtime/adapters/createK3sCliControlPlane.ts`
Source: `src/features/cluster-runtime/adapters/createK3sCliControlPlane.ts:19:1`

### Signatures

- `(options?: K3sCliControlPlaneOptions) => K3sControlPlane`
  - options: `K3sCliControlPlaneOptions` (optional)
  - returns: `K3sControlPlane`

## createK3sNodeCommandExecutor

Kind: `function`
Module: `src/features/cluster-runtime/adapters/createK3sNodeCommandExecutor.ts`
Source: `src/features/cluster-runtime/adapters/createK3sNodeCommandExecutor.ts:14:1`

### Signatures

- `() => K3sNodeCommandExecutor`
  - returns: `K3sNodeCommandExecutor`

## infraAdapterDescriptor

Kind: `value`
Module: `src/constants/infra.ts`
Source: `src/constants/infra.ts:5:14`

## K3sAdapterOptions

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:10:1`

### Members

| Name         | Kind     | Type                                     | Required | Description |
| ------------ | -------- | ---------------------------------------- | -------- | ----------- |
| cli          | property | `K3sCliControlPlaneOptions \| undefined` | no       |             |
| controlPlane | property | `K3sControlPlane \| undefined`           | no       |             |

## K3sCliControlPlaneOptions

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:38:1`

### Members

| Name                    | Kind     | Type                                                       | Required | Description |
| ----------------------- | -------- | ---------------------------------------------------------- | -------- | ----------- |
| executor                | property | `K3sNodeCommandExecutor \| undefined`                      | no       |             |
| installScriptLoader     | property | `((signal?: AbortSignal) => Promise<string>) \| undefined` | no       |             |
| pollIntervalMs          | property | `number \| undefined`                                      | no       |             |
| readinessTimeoutSeconds | property | `number \| undefined`                                      | no       |             |

## K3sClusterIdentity

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:45:1`

### Members

| Name        | Kind     | Type                                   | Required | Description |
| ----------- | -------- | -------------------------------------- | -------- | ----------- |
| environment | property | `"local" \| "preview" \| "production"` | yes      |             |
| name        | property | `string`                               | yes      |             |
| projectId   | property | `string`                               | yes      |             |

## K3sClusterObservation

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:93:1`

### Members

| Name                 | Kind     | Type                                                                                                 | Required | Description |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------- | -------- | ----------- |
| api                  | property | `KubernetesApi \| undefined`                                                                         | no       |             |
| configurationMatches | property | `boolean`                                                                                            | yes      |             |
| detail               | property | `string \| undefined`                                                                                | no       |             |
| nodes                | property | `readonly K3sNodeObservation[]`                                                                      | yes      |             |
| state                | property | `"absent" \| "pending" \| "ready" \| "degraded" \| "stopped" \| "retained" \| "failed" \| "unknown"` | yes      |             |

## K3sClusterSpec

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:62:1`

### Members

| Name        | Kind     | Type                                   | Required | Description |
| ----------- | -------- | -------------------------------------- | -------- | ----------- |
| environment | property | `"local" \| "preview" \| "production"` | yes      |             |
| name        | property | `string`                               | yes      |             |
| nodes       | property | `readonly K3sNodeSpec[]`               | yes      |             |
| projectId   | property | `string`                               | yes      |             |
| topology    | property | `K3sTopology`                          | yes      |             |
| version     | property | `string \| undefined`                  | no       |             |

## K3sControlPlane

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:102:1`

### Members

| Name                | Kind   | Type                                                                                                                                      | Required | Description |
| ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| destroyAsync        | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<null>>`                            | yes      |             |
| ensureAsync         | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<K3sClusterObservation>>`           | yes      |             |
| inspectAsync        | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<K3sClusterObservation>>`           | yes      |             |
| loadImagesAsync     | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], images: readonly string[], signal?: AbortSignal) => Promise<InfraResult<null>>` | yes      |             |
| suspendAsync        | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<null>>`                            | yes      |             |
| validateAsync       | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<null>>`                            | yes      |             |
| waitUntilReadyAsync | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<K3sClusterObservation>>`           | yes      |             |

## K3sDesiredState

Kind: `unknown`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:141:1`

## K3sNodeAccess

Kind: `unknown`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:69:1`

## K3sNodeCommandExecutor

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:34:1`

### Members

| Name     | Kind   | Type                                                                                       | Required | Description |
| -------- | ------ | ------------------------------------------------------------------------------------------ | -------- | ----------- |
| runAsync | method | `(access: K3sNodeAccess, request: K3sNodeCommandRequest) => Promise<K3sNodeCommandResult>` | yes      |             |

## K3sNodeCommandRequest

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:19:1`

### Members

| Name        | Kind     | Type                                            | Required | Description |
| ----------- | -------- | ----------------------------------------------- | -------- | ----------- |
| arguments   | property | `readonly string[]`                             | yes      |             |
| environment | property | `Readonly<Record<string, string>> \| undefined` | no       |             |
| executable  | property | `string`                                        | yes      |             |
| signal      | property | `AbortSignal \| undefined`                      | no       |             |
| stdin       | property | `string \| undefined`                           | no       |             |

## K3sNodeCommandResult

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:27:1`

### Members

| Name     | Kind     | Type     | Required | Description |
| -------- | -------- | -------- | -------- | ----------- |
| exitCode | property | `number` | yes      |             |
| stderr   | property | `string` | yes      |             |
| stdout   | property | `string` | yes      |             |

## K3sNodeObservation

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:86:1`

### Members

| Name                 | Kind     | Type                                                                                                 | Required | Description |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------- | -------- | ----------- |
| configurationMatches | property | `boolean`                                                                                            | yes      |             |
| detail               | property | `string \| undefined`                                                                                | no       |             |
| id                   | property | `string`                                                                                             | yes      |             |
| state                | property | `"absent" \| "pending" \| "ready" \| "degraded" \| "stopped" \| "retained" \| "failed" \| "unknown"` | yes      |             |

## K3sNodeSpec

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:56:1`

### Members

| Name   | Kind     | Type                  | Required | Description |
| ------ | -------- | --------------------- | -------- | ----------- |
| id     | property | `string`              | yes      |             |
| role   | property | `"server" \| "agent"` | yes      |             |
| target | property | `InfraComputeTarget`  | yes      |             |

## K3sTopology

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:51:1`

### Members

| Name    | Kind     | Type     | Required | Description |
| ------- | -------- | -------- | -------- | ----------- |
| agents  | property | `number` | yes      |             |
| servers | property | `number` | yes      |             |
