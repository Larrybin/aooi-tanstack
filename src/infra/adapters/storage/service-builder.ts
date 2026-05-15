import type {
  StorageUploadOptions,
  StorageUploadResult,
} from '@/extensions/storage';
import {
  deleteFilesFromCloudflareR2,
  getFileFromCloudflareR2,
  uploadFileToCloudflareR2,
} from '@/shared/platform/cloudflare/storage';

import {
  buildStorageSpikeUploadMockResult,
  isStorageSpikeUploadMockEnabled,
} from './upload-mock';

export type StorageRuntimeBindings = {
  publicBaseUrl: string;
};

export type StorageStoredFile = {
  body: ReadableStream<Uint8Array> | null;
  contentType: string;
  contentLength: number | null;
};

export type StorageService = {
  uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult>;
  getFile(key: string): Promise<StorageStoredFile | null>;
  deleteFiles(keys: string[]): Promise<void>;
};

type StorageBuilderInput = {
  bindings: StorageRuntimeBindings;
  options?: {
    uploadMockEnabled?: boolean;
  };
};

function assertBindingOnlyInput(
  input: unknown
): asserts input is StorageBuilderInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('bindings' in input) ||
    'configs' in input
  ) {
    throw new Error('Storage is binding-only');
  }
}

export function buildStorageService(
  input: StorageBuilderInput
): StorageService {
  assertBindingOnlyInput(input);

  const uploadMockEnabled =
    input.options?.uploadMockEnabled ?? isStorageSpikeUploadMockEnabled();
  const storagePublicBaseUrl = input.bindings.publicBaseUrl.trim();

  return {
    async uploadFile(options) {
      if (uploadMockEnabled) {
        return buildStorageSpikeUploadMockResult({
          key: options.key,
          publicDomain: storagePublicBaseUrl || undefined,
        });
      }

      return await uploadFileToCloudflareR2({
        options,
        storagePublicBaseUrl,
      });
    },
    async getFile(key) {
      if (uploadMockEnabled) {
        return null;
      }

      const object = await getFileFromCloudflareR2(key);
      if (!object) {
        return null;
      }

      return {
        body: object.body,
        contentType:
          object.httpMetadata?.contentType || 'application/octet-stream',
        contentLength: object.size ?? null,
      };
    },
    async deleteFiles(keys) {
      if (uploadMockEnabled) {
        return;
      }

      await deleteFilesFromCloudflareR2(keys);
    },
  } satisfies StorageService;
}
