import { getCloudflareBindings } from '@/infra/runtime/env.server';

import { toUint8Array, type StorageUploadOptions } from '@/extensions/storage';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { buildStorageObjectPublicUrl } from '@/shared/lib/storage-public-url';

export function getCloudflareStorageBucket(): R2Bucket | null {
  const bindings = getCloudflareBindings();
  const bucket = bindings?.APP_STORAGE_R2_BUCKET;
  return bucket instanceof Object ? (bucket as R2Bucket) : null;
}

export async function uploadFileToCloudflareR2({
  options,
  storagePublicBaseUrl,
}: {
  options: StorageUploadOptions;
  storagePublicBaseUrl: string;
}) {
  if (!storagePublicBaseUrl.trim()) {
    throw new ServiceUnavailableError(
      'STORAGE_PUBLIC_BASE_URL is not configured'
    );
  }

  const bucket = getCloudflareStorageBucket();
  if (!bucket) {
    throw new ServiceUnavailableError(
      'APP_STORAGE_R2_BUCKET binding is missing'
    );
  }

  const key = options.key.replace(/^\/+/, '').trim();
  if (!key) {
    throw new ServiceUnavailableError('storage object key is required');
  }

  await bucket.put(key, toUint8Array(options.body), {
    httpMetadata: {
      contentType: options.contentType,
      contentDisposition: options.disposition,
    },
  });

  const url = buildStorageObjectPublicUrl(key, storagePublicBaseUrl);

  return {
    success: true as const,
    provider: 'cloudflare-r2',
    key,
    url,
    location: url,
  };
}

export async function deleteFilesFromCloudflareR2(keys: string[]) {
  const bucket = getCloudflareStorageBucket();
  if (!bucket) {
    throw new ServiceUnavailableError(
      'APP_STORAGE_R2_BUCKET binding is missing'
    );
  }

  const normalizedKeys = keys
    .map((key) => key.replace(/^\/+/, '').trim())
    .filter(Boolean);
  if (!normalizedKeys.length) {
    return;
  }

  await bucket.delete(normalizedKeys);
}

export async function getFileFromCloudflareR2(key: string) {
  const bucket = getCloudflareStorageBucket();
  if (!bucket) {
    throw new ServiceUnavailableError(
      'APP_STORAGE_R2_BUCKET binding is missing'
    );
  }

  const normalizedKey = key.replace(/^\/+/, '').trim();
  if (!normalizedKey) {
    throw new ServiceUnavailableError('storage object key is required');
  }

  return bucket.get(normalizedKey);
}
