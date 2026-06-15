import { createApiContext } from '@/app/api/_lib/context';
import { getStorageService } from '@/infra/adapters/storage/service';
import { createStorageUploadImagePostHandler } from '@/server/api/storage/upload-image-route';
import { uploadImageFiles } from '@/server/api/storage/upload-image-files';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

export const POST = createStorageUploadImagePostHandler({
  resolveConfigConsistencyMode,
  getApiContext: createApiContext,
  readUploadRequestInput,
  uploadImageFiles,
  getStorageService,
  concurrencyLimiter:
    createLimiterFactory().createStorageUploadConcurrencyLimiter(),
});
