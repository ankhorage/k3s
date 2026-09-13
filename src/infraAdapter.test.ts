import { INFRA_ADAPTER_CATALOG, isInfraAdapterDescriptor } from '@ankhorage/contracts/infra';
import { describe, expect, it } from 'bun:test';

import { createInfraAdapter, infraAdapterDescriptor } from './index';
import { FakeK3sControlPlane } from './runtimeFixtures.test';

describe('k3s runtime adapter', () => {
  it('exports the exact Contracts catalog descriptor', () => {
    expect(infraAdapterDescriptor).toEqual(INFRA_ADAPTER_CATALOG.k3s);
    expect(isInfraAdapterDescriptor(infraAdapterDescriptor)).toBe(true);
  });

  it('rejects descriptor identity drift', () => {
    expect(
      isInfraAdapterDescriptor({
        ...infraAdapterDescriptor,
        package: '@ankhorage/not-k3s',
      }),
    ).toBe(false);
  });

  it('exposes the canonical implementation entrypoint', () => {
    const controlPlane = new FakeK3sControlPlane();
    expect(createInfraAdapter({ controlPlane }).descriptor).toBe(infraAdapterDescriptor);
  });
});
