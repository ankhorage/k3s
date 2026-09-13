import { createInfraAdapter, infraAdapterDescriptor } from '@ankhorage/k3s';

const adapter = createInfraAdapter();

console.log(infraAdapterDescriptor.id, adapter.descriptor.package);
