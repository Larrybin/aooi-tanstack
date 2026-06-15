
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

import {
  buildStorageService,
  type StorageRuntimeBindings,
  type StorageService,
} from './service-builder';

function readStorageRuntimeBindings(): StorageRuntimeBindings {
  return {
    publicBaseUrl: getRuntimeEnvString('STORAGE_PUBLIC_BASE_URL')?.trim() || '',
  };
}

export function getStorageRuntimeBindings(): StorageRuntimeBindings {
  return { ...readStorageRuntimeBindings() };
}

export async function getStorageService(
  _options: {
    mode?: ConfigConsistencyMode;
  } = {}
): Promise<StorageService> {
  return buildStorageService({
    bindings: readStorageRuntimeBindings(),
  });
}
