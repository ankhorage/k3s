import type { K3sControlPlane } from '@ankhorage/k3s';
import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/k3s';

declare const controlPlane: K3sControlPlane;
const adapter = createInfraAdapter({ controlPlane });

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
