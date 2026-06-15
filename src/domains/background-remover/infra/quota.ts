
import type { ProductActor } from '@/domains/product-access/domain/actor';
import { reserveProductQuota } from '@/domains/product-quota/application/quota-service';
import {
  commitProductQuotaReservationById,
  refundProductQuotaReservationById,
  reserveProductQuotaReservationWithQuotaCheck,
  toProductQuotaReservationInsert,
  type ProductQuotaReservation,
} from '@/domains/product-quota/infra/reservation';

import type { BackgroundRemoverQuotaOperationKey } from '../domain/types';

export const BACKGROUND_REMOVER_SITE_KEY = 'background-remover';
export const BACKGROUND_REMOVER_PRODUCT_KEY = 'background-remover';

export type ReserveBackgroundRemoverQuotaInput = {
  actor: ProductActor;
  productId: string;
  operationKey: BackgroundRemoverQuotaOperationKey;
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

export async function reserveBackgroundRemoverQuota(
  input: ReserveBackgroundRemoverQuotaInput
): Promise<{ reservation: ProductQuotaReservation; reused: boolean }> {
  return reserveProductQuota({
    actor: input.actor,
    siteKey: BACKGROUND_REMOVER_SITE_KEY,
    productKey: BACKGROUND_REMOVER_PRODUCT_KEY,
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
    quotaExceededMessage: 'background remover quota exceeded',
    deps: {
      reserve: ({ reservation, quota }) =>
        reserveProductQuotaReservationWithQuotaCheck({
          reservation: toProductQuotaReservationInsert(reservation),
          quota: {
            ...quota,
            quotaExceededMessage: 'background remover quota exceeded',
          },
        }),
    },
  });
}

export async function commitBackgroundRemoverQuotaReservation({
  reservationId,
  now,
}: {
  reservationId: string;
  now?: Date;
}) {
  return commitProductQuotaReservationById({ reservationId, now });
}

export async function refundBackgroundRemoverQuotaReservation({
  reservationId,
  reason,
  now,
}: {
  reservationId: string;
  reason?: string;
  now?: Date;
}) {
  return refundProductQuotaReservationById({ reservationId, reason, now });
}
