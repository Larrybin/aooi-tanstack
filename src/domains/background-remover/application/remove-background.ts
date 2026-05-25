import {
  getProductActorOwner,
  getProductOwnerKey,
} from '@/domains/product-access/domain/ownership';
import { getProductQuotaWindowStart } from '@/domains/product-quota/domain/reservation';
import type { StorageService } from '@/infra/adapters/storage/service-builder';

import {
  BadRequestError,
  ServiceUnavailableError,
  UpstreamError,
} from '@/shared/lib/api/errors';

import {
  addBackgroundRemoverRetentionDays,
  resolveBackgroundRemoverPlanLimits,
} from '../domain/plan';
import {
  BACKGROUND_REMOVER_QUOTA_OPERATION_KEYS,
  type BackgroundRemoverActor,
} from '../domain/types';
import type {
  createBackgroundRemoverImage,
  markBackgroundRemoverImagesDeletedByIds,
} from '../infra/image';
import type { reserveBackgroundRemoverQuota } from '../infra/quota';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const REQUEST_RESERVATION_TTL_MS = 10 * 60 * 1000;

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type BackgroundRemoverRemoveResult = {
  id: string;
  previewUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
  expiresAt: string;
};

export type RemoveImageBackgroundDeps = {
  storageService: Pick<StorageService, 'uploadFile' | 'deleteFiles'>;
  images: Pick<ImagesBinding, 'input'> | null;
  detectImageMime: (buffer: Buffer) => string | null;
  createImage: typeof createBackgroundRemoverImage;
  markImagesDeletedByIds: typeof markBackgroundRemoverImagesDeletedByIds;
  reserveQuota: typeof reserveBackgroundRemoverQuota;
  commitReservation: (input: {
    reservationId: string;
    now?: Date;
  }) => Promise<unknown>;
  refundReservation: (input: {
    reservationId: string;
    reason?: string;
    now?: Date;
  }) => Promise<unknown>;
  now?: () => Date;
  createId?: () => string;
};

export type RemoveImageBackgroundInput = {
  actor: BackgroundRemoverActor;
  file: File;
  width?: number;
  height?: number;
  deps: RemoveImageBackgroundDeps;
};

function assertDimension(value: number | undefined, label: string): number {
  if (!Number.isInteger(value) || !value || value <= 0 || value > 100000) {
    throw new BadRequestError(`invalid ${label}`);
  }
  return value;
}

function assertSupportedImage({
  file,
  buffer,
  detectedMime,
  maxUploadMb,
}: {
  file: File;
  buffer: Buffer;
  detectedMime: string | null;
  maxUploadMb: number;
}) {
  if (!file.size || file.size <= 0 || buffer.length <= 0) {
    throw new BadRequestError('image is empty');
  }

  const maxBytes = maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes || buffer.length > maxBytes) {
    throw new BadRequestError(`image is too large (max ${maxUploadMb}MB)`);
  }

  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    throw new BadRequestError('use a PNG, JPG, JPEG, or WebP image');
  }
}

function ownerStoragePath(actor: BackgroundRemoverActor): string {
  if (actor.kind === 'user') {
    return `user/${actor.userId}`;
  }
  return `anonymous/${actor.anonymousSessionId}`;
}

function createObjectKeys({
  actor,
  id,
  mimeType,
}: {
  actor: BackgroundRemoverActor;
  id: string;
  mimeType: string;
}) {
  const ownerPath = ownerStoragePath(actor);
  const extension = IMAGE_EXTENSION_BY_MIME[mimeType] ?? 'img';
  return {
    originalKey: `background-remover/${ownerPath}/${id}/original.${extension}`,
    resultKey: `background-remover/${ownerPath}/${id}/result.png`,
  };
}

async function uploadBuffer({
  storageService,
  body,
  key,
  contentType,
}: {
  storageService: Pick<StorageService, 'uploadFile'>;
  body: Buffer;
  key: string;
  contentType: string;
}) {
  const result = await storageService.uploadFile({
    body,
    key,
    contentType,
    disposition: 'inline',
  });

  if (!result.success || !result.key) {
    throw new UpstreamError(502, result.error || 'storage upload failed');
  }
  return result.key;
}

async function removeBackgroundWithImagesBinding({
  buffer,
  mimeType,
  images,
}: {
  buffer: Buffer;
  mimeType: string;
  images: Pick<ImagesBinding, 'input'> | null;
}) {
  if (!images) {
    throw new ServiceUnavailableError('Cloudflare Images binding is missing');
  }

  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  const stream = new Blob([arrayBuffer], { type: mimeType }).stream();
  const result = await images
    .input(stream)
    .transform({ segment: 'foreground' })
    .output({ format: 'image/png' });
  const response = result.response();
  if (!response.ok) {
    throw new UpstreamError(
      502,
      `background removal failed (${response.status})`
    );
  }

  const resultBuffer = Buffer.from(await response.arrayBuffer());
  if (!resultBuffer.length) {
    throw new UpstreamError(502, 'background removal returned an empty image');
  }

  return {
    buffer: resultBuffer,
    mimeType:
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      result.contentType() ||
      'image/png',
  };
}

export async function removeImageBackground({
  actor,
  file,
  width,
  height,
  deps,
}: RemoveImageBackgroundInput): Promise<BackgroundRemoverRemoveResult> {
  const now = (deps.now ?? (() => new Date()))();
  const createId = deps.createId ?? (() => crypto.randomUUID());
  const id = createId();
  const plan = resolveBackgroundRemoverPlanLimits(actor);
  const imageWidth = assertDimension(width, 'width');
  const imageHeight = assertDimension(height, 'height');
  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = deps.detectImageMime(buffer);
  assertSupportedImage({
    file,
    buffer,
    detectedMime,
    maxUploadMb: plan.maxUploadMb,
  });

  const owner = getProductActorOwner(actor);
  const expiresAt = addBackgroundRemoverRetentionDays(now, plan.retentionDays);
  const { originalKey, resultKey } = createObjectKeys({
    actor,
    id,
    mimeType: detectedMime!,
  });

  let reservationId = '';
  let createdImageId = '';
  const uploadedKeys: string[] = [];

  try {
    const { reservation } = await deps.reserveQuota({
      actor,
      productId: plan.productId,
      operationKey: BACKGROUND_REMOVER_QUOTA_OPERATION_KEYS.remove,
      units: 1,
      limit: plan.processingLimit,
      windowStart: getProductQuotaWindowStart(now, plan.processingWindow),
      idempotencyKey: [
        'background_remover.remove',
        getProductOwnerKey(owner),
        id,
      ].join(':'),
      expiresAt: new Date(now.getTime() + REQUEST_RESERVATION_TTL_MS),
      entitlementGrantIdsJson:
        actor.kind === 'user' && actor.entitlementGrantIds?.length
          ? JSON.stringify(actor.entitlementGrantIds)
          : null,
      now,
    });
    reservationId = reservation.id;

    uploadedKeys.push(
      await uploadBuffer({
        storageService: deps.storageService,
        body: buffer,
        key: originalKey,
        contentType: detectedMime!,
      })
    );

    const result = await removeBackgroundWithImagesBinding({
      buffer,
      mimeType: detectedMime!,
      images: deps.images,
    });

    uploadedKeys.push(
      await uploadBuffer({
        storageService: deps.storageService,
        body: result.buffer,
        key: resultKey,
        contentType: 'image/png',
      })
    );

    await deps.createImage({
      id,
      userId: owner.userId,
      anonymousSessionId: owner.anonymousSessionId,
      originalStorageKey: originalKey,
      resultStorageKey: resultKey,
      originalMimeType: detectedMime!,
      resultMimeType: result.mimeType,
      originalByteSize: buffer.length,
      resultByteSize: result.buffer.length,
      width: imageWidth,
      height: imageHeight,
      status: 'active',
      quotaReservationId: reservation.id,
      expiresAt,
    });
    createdImageId = id;
    await deps.commitReservation({ reservationId: reservation.id, now });

    return {
      id,
      previewUrl: `/api/background-remover/result/${encodeURIComponent(id)}`,
      downloadUrl: `/api/background-remover/download/${encodeURIComponent(id)}`,
      width: imageWidth,
      height: imageHeight,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error: unknown) {
    if (createdImageId) {
      await deps
        .markImagesDeletedByIds({
          ids: [createdImageId],
          now,
        })
        .catch(() => undefined);
    }
    if (reservationId) {
      await deps
        .refundReservation({
          reservationId,
          reason: error instanceof Error ? error.message : 'remove failed',
          now,
        })
        .catch(() => undefined);
    }
    if (uploadedKeys.length) {
      await deps.storageService
        .deleteFiles(uploadedKeys)
        .catch(() => undefined);
    }
    throw error;
  }
}
