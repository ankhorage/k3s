# Public API

## createInfraAdapter

Kind: `function`
Module: `src/features/cluster-runtime/composition/createInfraAdapter.ts`
Source: `src/features/cluster-runtime/composition/createInfraAdapter.ts:20:1`

Create the canonical k3s runtime adapter entrypoint.

The caller supplies a k3s-specific control-plane boundary. Standard workload projection and
reconciliation are delegated to the published Kubernetes driver.

### Signatures

- `(options: K3sAdapterOptions) => InfraRuntimeAdapter<"k3s">`
  - options: `K3sAdapterOptions`
  - returns: `InfraRuntimeAdapter<"k3s">`

## infraAdapterDescriptor

Kind: `value`
Module: `src/constants/infra.ts`
Source: `src/constants/infra.ts:5:14`

## K3sAdapterOptions

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:10:1`

### Members

| Name         | Kind     | Type              | Required | Description |
| ------------ | -------- | ----------------- | -------- | ----------- |
| controlPlane | property | `K3sControlPlane` | yes      |             |

## K3sClusterIdentity

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:14:1`

### Members

| Name        | Kind     | Type                                   | Required | Description |
| ----------- | -------- | -------------------------------------- | -------- | ----------- |
| environment | property | `"local" \| "preview" \| "production"` | yes      |             |
| name        | property | `string`                               | yes      |             |
| projectId   | property | `string`                               | yes      |             |

## K3sClusterObservation

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:62:1`

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
Source: `src/types/k3sRuntime.ts:31:1`

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
Source: `src/types/k3sRuntime.ts:71:1`

### Members

| Name                | Kind   | Type                                                                                                                            | Required | Description |
| ------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| destroyAsync        | method | `(identity: K3sClusterIdentity, signal?: AbortSignal) => Promise<InfraResult<null>>`                                            | yes      |             |
| ensureAsync         | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<K3sClusterObservation>>` | yes      |             |
| inspectAsync        | method | `(identity: K3sClusterIdentity, signal?: AbortSignal) => Promise<InfraResult<K3sClusterObservation>>`                           | yes      |             |
| loadImagesAsync     | method | `(identity: K3sClusterIdentity, images: readonly string[], signal?: AbortSignal) => Promise<InfraResult<null>>`                 | yes      |             |
| suspendAsync        | method | `(identity: K3sClusterIdentity, signal?: AbortSignal) => Promise<InfraResult<null>>`                                            | yes      |             |
| validateAsync       | method | `(spec: K3sClusterSpec, access: readonly K3sNodeAccess[], signal?: AbortSignal) => Promise<InfraResult<null>>`                  | yes      |             |
| waitUntilReadyAsync | method | `(identity: K3sClusterIdentity, signal?: AbortSignal) => Promise<InfraResult<K3sClusterObservation>>`                           | yes      |             |

## K3sDesiredState

Kind: `unknown`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:99:1`

## K3sNodeAccess

Kind: `unknown`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:38:1`

## K3sNodeObservation

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:55:1`

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
Source: `src/types/k3sRuntime.ts:25:1`

### Members

| Name   | Kind     | Type                  | Required | Description |
| ------ | -------- | --------------------- | -------- | ----------- |
| id     | property | `string`              | yes      |             |
| role   | property | `"server" \| "agent"` | yes      |             |
| target | property | `InfraComputeTarget`  | yes      |             |

## K3sTopology

Kind: `type`
Module: `src/types/k3sRuntime.ts`
Source: `src/types/k3sRuntime.ts:20:1`

### Members

| Name    | Kind     | Type     | Required | Description |
| ------- | -------- | -------- | -------- | ----------- |
| agents  | property | `number` | yes      |             |
| servers | property | `number` | yes      |             |
