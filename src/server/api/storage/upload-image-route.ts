import type { StorageService } from '@/infra/adapters/storage/service-builder';

import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import {
  resolveConfigConsistencyMode,
  type ConfigConsistencyMode,
} from '@/shared/lib/config-consistency';

import type { uploadImageFiles } from './upload-image-files';

type MaybePromise<T> = T | Promise<T>;
type StorageUploadLog = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

type ApiContextLike = {
  log: StorageUploadLog;
  requireUser: () => Promise<{ id: string }>;
};

type StorageUploadRouteDeps = {
  resolveConfigConsistencyMode: typeof resolveConfigConsistencyMode;
  getApiContext: (req: Request) => MaybePromise<ApiContextLike>;
  readUploadRequestInput: (req: Request) => Promise<{
    entries: unknown[];
    files: File[];
    runtimePlatform: string;
  }>;
  uploadImageFiles: typeof uploadImageFiles;
  getStorageService: (options: {
    mode?: ConfigConsistencyMode;
  }) => Promise<Pick<StorageService, 'uploadFile'>>;
  concurrencyLimiter: {
    acquire: (key: string, now?: number) => Promise<boolean>;
    release: (key: string, now?: number) => Promise<void>;
  };
};

export function createStorageUploadImagePostHandler(
  deps: StorageUploadRouteDeps
) {
  return withApi(buildStorageUploadImagePostLogic(deps));
}

function buildStorageUploadImagePostLogic(deps: StorageUploadRouteDeps) {
  return async (req: Request) => {
    const api = await deps.getApiContext(req);
    const { log } = api;
    const mode: ConfigConsistencyMode = deps.resolveConfigConsistencyMode(req);
    const user = await api.requireUser();
    if (!(await deps.concurrencyLimiter.acquire(user.id))) {
      throw new TooManyRequestsError('too many concurrent uploads');
    }

    try {
      const { entries, files, runtimePlatform } =
        await deps.readUploadRequestInput(req);

      if (files.length !== entries.length) {
        throw new BadRequestError('invalid files');
      }

      log.debug('storage: upload request accepted', {
        runtimePlatform,
        fileCount: files.length,
      });

      const uploadResults = await deps.uploadImageFiles({
        files,
        deps: {
          getStorageService: () => deps.getStorageService({ mode }),
          log,
        },
      });

      return jsonOk({
        results: uploadResults,
      });
    } finally {
      await deps.concurrencyLimiter.release(user.id);
    }
  };
}
