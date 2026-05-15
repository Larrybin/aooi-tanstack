import type { StorageService } from '@/infra/adapters/storage/service-builder';

import {
  BadRequestError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { getUuid } from '@/shared/lib/hash';

import { getRemoverOwner } from '../domain/actor';
import { addRetentionDays, resolveRemoverPlanLimits } from '../domain/plan';
import { getQuotaWindowStart } from '../domain/quota';
import type { RemoverActor, RemoverImageAssetKind } from '../domain/types';
import type {
  NewRemoverImageAsset,
  RemoverImageAsset,
} from '../infra/image-asset';
import type {
  NewRemoverQuotaReservation,
  RemoverQuotaReservation,
} from '../infra/quota-reservation';

const REMOVER_IMAGE_EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type RemoverUploadDeps = {
  storageService: Pick<StorageService, 'uploadFile' | 'deleteFiles'>;
  createAsset: (asset: NewRemoverImageAsset) => Promise<RemoverImageAsset>;
  reserveUploadQuota: (input: {
    reservation: NewRemoverQuotaReservation;
    quota: {
      userId: string | null;
      anonymousSessionId: string | null;
      quotaType: 'upload';
      windowStart: Date;
      limit: number;
      requestedUnits: number;
      now?: Date;
    };
  }) => Promise<{ reservation: RemoverQuotaReservation; reused: boolean }>;
  commitReservation: (input: {
    reservationId: string;
    now?: Date;
  }) => Promise<unknown>;
  refundReservation: (input: {
    reservationId: string;
    reason?: string;
    now?: Date;
  }) => Promise<unknown>;
  detectImageMime: (buffer: Buffer) => string | null;
  acquireGuestIpLimit?: (
    actor: RemoverActor
  ) => Promise<(() => Promise<void>) | undefined>;
  createId?: () => string;
  now?: () => Date;
};

function assertRemoverAssetKind(kind: string): asserts kind is
  | 'original'
  | 'mask' {
  if (kind !== 'original' && kind !== 'mask') {
    throw new BadRequestError('invalid remover image kind');
  }
}

function resolveFileExtension(mimeType: string): string {
  const ext =
    REMOVER_IMAGE_EXT_BY_MIME[
      mimeType as keyof typeof REMOVER_IMAGE_EXT_BY_MIME
    ];
  if (!ext) {
    throw new BadRequestError('unsupported image type');
  }
  return ext;
}

export async function uploadRemoverImage({
  actor,
  file,
  kind,
  width,
  height,
  deps,
}: {
  actor: RemoverActor;
  file: File;
  kind: string;
  width?: number | null;
  height?: number | null;
  deps: RemoverUploadDeps;
}) {
  assertRemoverAssetKind(kind);

  if (!file || !file.size || file.size <= 0) {
    throw new BadRequestError('image file is required');
  }

  const plan = resolveRemoverPlanLimits(actor);
  const maxBytes = plan.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new BadRequestError(`image is too large (max ${plan.maxUploadMb}MB)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = deps.detectImageMime(buffer);
  if (!mimeType) {
    throw new BadRequestError('unsupported image type');
  }
  const ext = resolveFileExtension(mimeType);
  const releaseGuestIpLimit = await deps.acquireGuestIpLimit?.(actor);

  const id = (deps.createId ?? getUuid)();
  const now = (deps.now ?? (() => new Date()))();
  const owner = getRemoverOwner(actor);
  const uploadLimit = plan.processingLimit * 2;
  const ownerPath = owner.userId
    ? `users/${owner.userId}`
    : `anonymous/${owner.anonymousSessionId}`;
  const storageKey = `remover/${ownerPath}/${kind}/${id}.${ext}`;

  let quotaReservation: { reservation: RemoverQuotaReservation } | undefined;
  let uploadedKey = '';
  let asset: RemoverImageAsset;
  try {
    quotaReservation = await deps.reserveUploadQuota({
      reservation: {
        id: (deps.createId ?? getUuid)(),
        ...owner,
        productId: plan.productId,
        quotaType: 'upload',
        units: 1,
        status: 'reserved',
        idempotencyKey: `upload:${owner.userId ?? owner.anonymousSessionId}:${id}`,
        expiresAt: addRetentionDays(now, 1),
      },
      quota: {
        ...owner,
        quotaType: 'upload',
        windowStart: getQuotaWindowStart(now, plan.processingWindow),
        limit: uploadLimit,
        requestedUnits: 1,
        now,
      },
    });

    const uploaded = await deps.storageService.uploadFile({
      body: buffer,
      key: storageKey,
      contentType: mimeType,
      disposition: 'inline',
    });

    if (!uploaded.success || !uploaded.key || !uploaded.url) {
      throw new UpstreamError(502, uploaded.error || 'upload failed');
    }
    uploadedKey = uploaded.key;

    asset = await deps.createAsset({
      id,
      ...owner,
      kind: kind satisfies RemoverImageAssetKind,
      storageKey: uploaded.key,
      url: uploaded.url,
      mimeType,
      byteSize: file.size,
      width: width ?? null,
      height: height ?? null,
      status: 'active',
      expiresAt: addRetentionDays(now, plan.retentionDays),
    });
    await deps.commitReservation({
      reservationId: quotaReservation.reservation.id,
      now,
    });
  } catch (error) {
    if (uploadedKey) {
      await deps.storageService.deleteFiles([uploadedKey]).catch(() => undefined);
    }
    if (quotaReservation) {
      await deps
        .refundReservation({
          reservationId: quotaReservation.reservation.id,
          reason: error instanceof Error ? error.message : 'upload failed',
          now,
        })
        .catch(() => undefined);
    }
    throw error;
  } finally {
    await releaseGuestIpLimit?.().catch(() => undefined);
  }

  return {
    asset,
    anonymousSessionId: owner.anonymousSessionId,
  };
}
