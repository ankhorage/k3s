# @ankhorage/k3s

## 0.4.1

### Patch Changes

- e3bf8b5: Consume Contracts 19.4 and Kubernetes 0.8 so k3s supports portable image-seeded persistent volumes.

## 0.4.0

### Minor Changes

- 5b39813: Reconcile canonical ACME HTTP-01 networking intent through an Infra-owned Traefik HelmChartConfig while preserving foreign Traefik configuration.

## 0.3.1

### Patch Changes

- 5a219ed: Require current Contracts and Kubernetes workload boundaries so runtime consumers cannot resolve a Kubernetes version that predates workload template materialization.

## 0.3.0

### Minor Changes

- 174340e: Implement the concrete local and verified-SSH k3s lifecycle on Contracts 17 and Kubernetes 0.5.

## 0.2.0

### Minor Changes

- ea58e26: Implement the portable local and remote k3s runtime lifecycle through the shared Kubernetes driver.

## 0.1.0

### Minor Changes

- 03ea3b1: Publish the initial provider-neutral infrastructure package foundation.

## 0.0.0

Initial unpublished package state.
