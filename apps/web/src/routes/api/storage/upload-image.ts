import { createStorageUploadImagePostHandler } from '@/server/api/storage/upload-image-route';
import { uploadImageFiles } from '@/server/api/storage/upload-image-files';
import { createFileRoute } from '@tanstack/react-router';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';
import { getTanStackStorageService } from '../../../server/storage-runtime';

const postStorageUploadImage = withTanStackCloudflareBindings(
  createStorageUploadImagePostHandler({
    resolveConfigConsistencyMode,
    getApiContext: createTanStackApiContext,
    readUploadRequestInput,
    uploadImageFiles,
    getStorageService: async () => getTanStackStorageService(),
    concurrencyLimiter:
      createLimiterFactory().createStorageUploadConcurrencyLimiter(),
  })
);

export const Route = createFileRoute('/api/storage/upload-image')({
  server: {
    handlers: {
      POST: ({ request }) => postStorageUploadImage(request),
    },
  },
});
