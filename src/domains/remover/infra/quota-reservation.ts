import 'server-only';

import type { ProductActor } from '@/domains/product-access/domain/actor';
import {
  reserveProductQuota,
  type ProductQuotaCheck,
  type ProductQuotaReservationDraft,
} from '@/domains/product-quota/application/quota-service';
import {
  assertProductQuotaReservationAvailable,
  claimProductQuotaReservationById,
  commitProductQuotaReservationById,
  countActiveProductQuotaUnits,
  findProductQuotaReservationByIdempotencyKey,
  insertProductQuotaReservationAfterQuotaCheck,
  lockProductQuotaReservationCreation,
  productQuotaOwnerCondition,
  refundProductQuotaReservationById,
  reserveProductQuotaReservationWithQuotaCheck,
  toProductQuotaReservationInsert,
  updateProductQuotaReservationStatus,
  type NewProductQuotaReservation,
  type ProductQuotaReservation,
  type ProductQuotaReservationCheck,
} from '@/domains/product-quota/infra/reservation';
import type { db } from '@/infra/adapters/db';

import { getRemoverQuotaTypeForOperationKey } from '../domain/quota';
import type { RemoverQuotaOperationKey } from '../domain/types';

export type RemoverQuotaReservation = ProductQuotaReservation;
export type NewRemoverQuotaReservation = NewProductQuotaReservation;
export type QuotaReservationCheck = ProductQuotaReservationCheck & {
  quotaType: string;
};

export type ReserveRemoverQuotaInput = {
  actor: ProductActor;
  productId: string;
  operationKey: RemoverQuotaOperationKey;
  units: number;
  limit: number;
  windowStart: Date;
  idempotencyKey: string;
  expiresAt: Date;
  jobId?: string | null;
  reason?: string | null;
  entitlementGrantIdsJson?: string | null;
  now?: Date;
  createId?: () => string;
};

type RemoverDbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

export const REMOVER_QUOTA_SITE_KEY = 'ai-remover';
export const REMOVER_QUOTA_PRODUCT_KEY = 'ai-remover';

export function toRemoverQuotaReservationInsert(
  reservation: ProductQuotaReservationDraft
): NewRemoverQuotaReservation {
  return toProductQuotaReservationInsert(reservation);
}

export function toRemoverQuotaCheck(
  quota: ProductQuotaCheck
): QuotaReservationCheck {
  return {
    userId: quota.userId,
    anonymousSessionId: quota.anonymousSessionId,
    siteKey: quota.siteKey,
    productKey: quota.productKey,
    operationKey: quota.operationKey,
    quotaType: getRemoverQuotaTypeForOperationKey(
      quota.operationKey as RemoverQuotaOperationKey
    ),
    windowStart: quota.windowStart,
    limit: quota.limit,
    requestedUnits: quota.requestedUnits,
    now: quota.now,
    quotaExceededMessage: 'remover quota exceeded',
  };
}

export async function reserveRemoverQuota(
  input: ReserveRemoverQuotaInput
): Promise<{ reservation: RemoverQuotaReservation; reused: boolean }> {
  return reserveProductQuota({
    actor: input.actor,
    siteKey: REMOVER_QUOTA_SITE_KEY,
    productKey: REMOVER_QUOTA_PRODUCT_KEY,
    productId: input.productId,
    operationKey: input.operationKey,
    units: input.units,
    limit: input.limit,
    windowStart: input.windowStart,
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
    jobId: input.jobId,
    reason: input.reason,
    entitlementGrantIdsJson: input.entitlementGrantIdsJson,
    now: input.now,
    createId: input.createId,
    quotaExceededMessage: 'remover quota exceeded',
    deps: {
      reserve: ({ reservation, quota }) =>
        reserveProductQuotaReservationWithQuotaCheck({
          reservation: toRemoverQuotaReservationInsert(reservation),
          quota: toRemoverQuotaCheck(quota),
        }),
    },
  });
}

export function removerQuotaOwnerCondition({
  userId,
  anonymousSessionId,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
}) {
  return productQuotaOwnerCondition({ userId, anonymousSessionId });
}

export async function lockRemoverQuotaReservationCreation(
  tx: RemoverDbTransaction,
  {
    idempotencyKey,
    quota,
  }: {
    idempotencyKey: string;
    quota: QuotaReservationCheck;
  }
) {
  await lockProductQuotaReservationCreation(tx, { idempotencyKey, quota });
}

export async function assertRemoverQuotaAvailable(
  tx: RemoverDbTransaction,
  quota: QuotaReservationCheck
) {
  await assertProductQuotaReservationAvailable(tx, quota);
}

export async function insertRemoverQuotaReservationAfterQuotaCheck(
  tx: RemoverDbTransaction,
  {
    reservation,
    quota,
  }: {
    reservation: NewRemoverQuotaReservation;
    quota: QuotaReservationCheck;
  }
) {
  return insertProductQuotaReservationAfterQuotaCheck(tx, {
    reservation,
    quota,
  });
}

export async function findRemoverQuotaReservationByIdempotencyKey(
  idempotencyKey: string
) {
  return findProductQuotaReservationByIdempotencyKey(idempotencyKey);
}

export async function createRemoverQuotaReservationWithQuotaCheck({
  reservation,
  quota,
}: {
  reservation: NewRemoverQuotaReservation;
  quota: QuotaReservationCheck;
}): Promise<{ reservation: RemoverQuotaReservation; reused: boolean }> {
  return reserveProductQuotaReservationWithQuotaCheck({
    reservation,
    quota,
  });
}

export async function countActiveRemoverQuotaUnits({
  userId,
  anonymousSessionId,
  quotaType,
  windowStart,
  now,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  quotaType: string;
  windowStart: Date;
  now?: Date;
}): Promise<number> {
  const operationKey =
    quotaType === 'upload'
      ? 'upload.create'
      : quotaType === 'high_res_download'
        ? 'image.hd_download'
        : 'image.remove';
  return countActiveProductQuotaUnits({
    userId,
    anonymousSessionId,
    siteKey: REMOVER_QUOTA_SITE_KEY,
    productKey: REMOVER_QUOTA_PRODUCT_KEY,
    operationKey,
    windowStart,
    now,
  });
}

export async function claimRemoverQuotaReservationById({
  reservationId,
  userId,
  anonymousSessionId,
}: {
  reservationId: string;
  userId: string;
  anonymousSessionId: string;
}) {
  return claimProductQuotaReservationById({
    reservationId,
    userId,
    anonymousSessionId,
  });
}

export async function updateRemoverQuotaReservationStatus({
  reservationId,
  status,
  reason,
  now,
}: {
  reservationId: string;
  status: 'committed' | 'refunded';
  reason?: string;
  now: Date;
}) {
  return updateProductQuotaReservationStatus({
    reservationId,
    status,
    reason,
    now,
  });
}

export async function commitRemoverQuotaReservation({
  reservationId,
  now,
}: {
  reservationId: string;
  now?: Date;
}) {
  return commitProductQuotaReservationById({
    reservationId,
    now,
  });
}

export async function refundRemoverQuotaReservation({
  reservationId,
  reason,
  now,
}: {
  reservationId: string;
  reason?: string;
  now?: Date;
}) {
  return refundProductQuotaReservationById({
    reservationId,
    reason,
    now,
  });
}
