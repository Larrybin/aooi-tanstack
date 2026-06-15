import {
  buildStorageService,
  type StorageRuntimeBindings,
  type StorageService,
} from '@/infra/adapters/storage/service-builder';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { readTanStackCloudflareBindings } from './cloudflare-bindings';

export async function readTanStackStorageRuntimeBindings(): Promise<StorageRuntimeBindings> {
  const bindings = await readTanStackCloudflareBindings();

  return {
    publicBaseUrl:
      getRuntimeEnvString('STORAGE_PUBLIC_BASE_URL', { bindings })?.trim() ||
      '',
  };
}

export async function getTanStackStorageService(): Promise<StorageService> {
  return buildStorageService({
    bindings: await readTanStackStorageRuntimeBindings(),
  });
}
