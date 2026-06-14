import { cleanupExpiredBackgroundRemoverImages } from '@/domains/background-remover/application/cleanup';
import { removeImageBackground } from '@/domains/background-remover/application/remove-background';
import { readBackgroundRemoverResultFile } from '@/domains/background-remover/application/result';
import type { BackgroundRemoverActor } from '@/domains/background-remover/domain/types';
import type {
  createBackgroundRemoverImage,
  findBackgroundRemoverImageByIdForOwner,
  listExpiredBackgroundRemoverImages,
  markBackgroundRemoverImagesDeletedByIds,
} from '@/domains/background-remover/infra/image';
import type {
  commitBackgroundRemoverQuotaReservation,
  refundBackgroundRemoverQuotaReservation,
  reserveBackgroundRemoverQuota,
} from '@/domains/background-remover/infra/quota';
import type { getStorageService } from '@/infra/adapters/storage/service';
import type { StorageService } from '@/infra/adapters/storage/service-builder';
import type {
  getCloudflareImagesBinding,
  getRuntimeEnvString,
} from '@/infra/runtime/env.server';
import { z } from 'zod';

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { readUploadRequestInput } from '@/shared/lib/runtime/upload';

import { detectAllowedImageMime } from '../storage/image-mime';
import type { resolveBackgroundRemoverActor } from './actor';
import type { requireBackgroundRemoverSite } from './guard';

const BACKGROUND_REMOVER_UPLOAD_REQUEST_BYTES = 22 * 1024 * 1024;
const DimensionSchema = z.coerce.number().int().positive().max(100000);

export type BackgroundRemoverRoutesDeps = {
  commitReservation: typeof commitBackgroundRemoverQuotaReservation;
  createImage: typeof createBackgroundRemoverImage;
  findImageByIdForOwner: typeof findBackgroundRemoverImageByIdForOwner;
  listExpiredImages: typeof listExpiredBackgroundRemoverImages;
  getStorageService: typeof getStorageService;
  getImagesBinding: typeof getCloudflareImagesBinding;
  getRuntimeEnvString: typeof getRuntimeEnvString;
  markImagesDeletedByIds: typeof markBackgroundRemoverImagesDeletedByIds;
  refundReservation: typeof refundBackgroundRemoverQuotaReservation;
  requireSite: typeof requireBackgroundRemoverSite;
  reserveQuota: typeof reserveBackgroundRemoverQuota;
  resolveActor: typeof resolveBackgroundRemoverActor;
};

type PendingResponseHeaders = {
  appendSetCookie(value: string): void;
  apply(response: Response): Response;
};

function createPendingResponseHeaders(): PendingResponseHeaders {
  const setCookies: string[] = [];

  return {
    appendSetCookie(value) {
      setCookies.push(value);
    },
    apply(response) {
      if (!setCookies.length) {
        return response;
      }

      const headers = new Headers(response.headers);
      for (const setCookie of setCookies) {
        headers.append('set-cookie', setCookie);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  };
}

function parseDimension(formData: FormData, key: string): number {
  const result = DimensionSchema.safeParse(formData.get(key));
  if (!result.success) {
    throw new BadRequestError(`invalid ${key}`);
  }
  return result.data;
}

function withBackgroundRemoverApi(
  deps: BackgroundRemoverRoutesDeps,
  handler: (req: Request, context?: unknown) => Promise<Response> | Response
) {
  return withApi((req: Request, context?: unknown) => {
    deps.requireSite();
    return handler(req, context);
  });
}

async function readRouteId(context: unknown): Promise<string> {
  const routeParams =
    typeof context === 'object' && context && 'params' in context
      ? await Promise.resolve((context as { params: unknown }).params)
      : {};
  const id =
    typeof routeParams === 'object' &&
    routeParams &&
    'id' in routeParams &&
    typeof (routeParams as { id: unknown }).id === 'string'
      ? (routeParams as { id: string }).id
      : '';
  if (!id) {
    throw new BadRequestError('invalid route params');
  }
  return id;
}

function imageResponse(input: {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number | null;
}) {
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': input.contentType || 'image/png',
    'Content-Disposition': 'inline',
  });
  if (input.contentLength !== null) {
    headers.set('Content-Length', String(input.contentLength));
  }
  return new Response(input.body, { headers });
}

function downloadResponse(input: {
  id: string;
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number | null;
}) {
  const filename = `background-remover-${input.id}.png`;
  const headers = new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Type': input.contentType || 'image/png',
    'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  });
  if (input.contentLength !== null) {
    headers.set('Content-Length', String(input.contentLength));
  }

  return new Response(input.body, { headers });
}

function assertCleanupSecret(req: Request, deps: BackgroundRemoverRoutesDeps) {
  const secret =
    deps.getRuntimeEnvString('REMOVER_CLEANUP_SECRET')?.trim() || '';
  if (!secret) {
    throw new NotFoundError('not found');
  }

  const authorization = req.headers.get('authorization')?.trim() || '';
  if (authorization !== `Bearer ${secret}`) {
    throw new ForbiddenError('forbidden');
  }
}

function createPostBackgroundRemoverRemove(deps: BackgroundRemoverRoutesDeps) {
  return withBackgroundRemoverApi(deps, async (req) => {
    const responseHeaders = createPendingResponseHeaders();
    const actor = await deps.resolveActor(req, responseHeaders);
    const { entries, files, formData } = await readUploadRequestInput(
      req,
      'image',
      BACKGROUND_REMOVER_UPLOAD_REQUEST_BYTES
    );

    if (entries.length !== files.length || files.length !== 1) {
      throw new BadRequestError('exactly one image file is required');
    }

    const result = await removeImageBackground({
      actor,
      file: files[0]!,
      width: parseDimension(formData, 'width'),
      height: parseDimension(formData, 'height'),
      deps: {
        storageService: await deps.getStorageService(),
        images: deps.getImagesBinding(),
        detectImageMime: detectAllowedImageMime,
        createImage: deps.createImage,
        markImagesDeletedByIds: deps.markImagesDeletedByIds,
        reserveQuota: deps.reserveQuota,
        commitReservation: deps.commitReservation,
        refundReservation: deps.refundReservation,
      },
    });

    return responseHeaders.apply(
      jsonOk(result, { headers: { 'Cache-Control': 'no-store' } })
    );
  });
}

function createGetBackgroundRemoverResult(deps: BackgroundRemoverRoutesDeps) {
  return withBackgroundRemoverApi(deps, async (req, context) => {
    const responseHeaders = createPendingResponseHeaders();
    const id = await readRouteId(context);
    const actor = await deps.resolveActor(req, responseHeaders);
    const file = await readBackgroundRemoverResultFile({
      actor,
      id,
      deps: {
        findImageByIdForOwner: deps.findImageByIdForOwner,
        storageService: await deps.getStorageService(),
      },
    });

    return responseHeaders.apply(imageResponse(file));
  });
}

function createGetBackgroundRemoverDownload(deps: BackgroundRemoverRoutesDeps) {
  return withBackgroundRemoverApi(deps, async (req, context) => {
    const responseHeaders = createPendingResponseHeaders();
    const id = await readRouteId(context);
    const actor = await deps.resolveActor(req, responseHeaders);
    const file = await readBackgroundRemoverResultFile({
      actor,
      id,
      deps: {
        findImageByIdForOwner: deps.findImageByIdForOwner,
        storageService: await deps.getStorageService(),
      },
    });

    return responseHeaders.apply(
      downloadResponse({
        id: file.image.id,
        body: file.body,
        contentType: file.contentType,
        contentLength: file.contentLength,
      })
    );
  });
}

function createPostBackgroundRemoverCleanup(deps: BackgroundRemoverRoutesDeps) {
  return withBackgroundRemoverApi(deps, async (req) => {
    assertCleanupSecret(req, deps);
    const result = await cleanupExpiredBackgroundRemoverImages({
      deps: {
        listExpiredImages: deps.listExpiredImages,
        markImagesDeletedByIds: deps.markImagesDeletedByIds,
        storageService: await deps.getStorageService(),
      },
    });

    return jsonOk(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  });
}

export function createBackgroundRemoverRoutes(
  deps: BackgroundRemoverRoutesDeps
) {
  return {
    getBackgroundRemoverDownload: createGetBackgroundRemoverDownload(deps),
    getBackgroundRemoverResult: createGetBackgroundRemoverResult(deps),
    postBackgroundRemoverCleanup: createPostBackgroundRemoverCleanup(deps),
    postBackgroundRemoverRemove: createPostBackgroundRemoverRemove(deps),
  };
}

export type BackgroundRemoverRouteTestActor = BackgroundRemoverActor;
export type BackgroundRemoverRouteTestStorage = Pick<
  StorageService,
  'deleteFiles' | 'getFile' | 'uploadFile'
>;
