import type { ProductActor } from '@/domains/product-access/domain/actor';
import {
  getProductActorOwner,
  type ProductOwner,
} from '@/domains/product-access/domain/ownership';

import { getUuid } from '@/shared/lib/hash';

import { assertProductQuotaAvailable } from '../domain/reservation';

export type ProductQuotaOperationKey = string;

export type ProductQuotaReservationDraft = ProductOwner & {
  id: string;
  siteKey: string;
  productKey: string;
  productId: string;
  operationKey: ProductQuotaOperationKey;
  units: number;
  status: 'reserved';
  idempotencyKey: string;
  jobId: string | null;
  reason: string | null;
  entitlementGrantIdsJson: string | null;
  expiresAt: Date;
};

export type ProductQuotaCheck = ProductOwner & {
  siteKey: string;
  productKey: string;
  operationKey: ProductQuotaOperationKey;
  windowStart: Date;
  limit: number;
  requestedUnits: number;
  now?: Date;
};

export type ReserveProductQuotaStoreInput = {
  reservation: ProductQuotaReservationDraft;
  quota: ProductQuotaCheck;
};

export async function reserveProductQuota<TResult>({
  actor,
  siteKey,
  productKey,
  productId,
  operationKey,
  units,
  limit,
  windowStart,
  idempotencyKey,
  expiresAt,
  jobId = null,
  reason = null,
  entitlementGrantIdsJson = null,
  now,
  createId = getUuid,
  quotaExceededMessage,
  deps,
}: {
  actor: ProductActor;
  siteKey: string;
  productKey: string;
  productId: string;
  operationKey: ProductQuotaOperationKey;
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
  quotaExceededMessage?: string;
  deps: {
    reserve: (input: ReserveProductQuotaStoreInput) => Promise<TResult>;
  };
}): Promise<TResult> {
  assertProductQuotaAvailable({
    usedUnits: 0,
    requestedUnits: units,
    limit,
    quotaExceededMessage,
  });

  const owner = getProductActorOwner(actor);
  // The product storage adapter owns windowed usage checks and locking.
  return deps.reserve({
    reservation: {
      id: createId(),
      ...owner,
      siteKey,
      productKey,
      productId,
      operationKey,
      units,
      status: 'reserved',
      idempotencyKey,
      jobId,
      reason,
      entitlementGrantIdsJson,
      expiresAt,
    },
    quota: {
      ...owner,
      siteKey,
      productKey,
      operationKey,
      windowStart,
      limit,
      requestedUnits: units,
      now,
    },
  });
}

export async function commitProductQuota<TResult>({
  reservationId,
  now,
  deps,
}: {
  reservationId: string;
  now?: Date;
  deps: {
    commit: (input: { reservationId: string; now?: Date }) => Promise<TResult>;
  };
}): Promise<TResult> {
  return deps.commit({ reservationId, now });
}

export async function refundProductQuota<TResult>({
  reservationId,
  reason,
  now,
  deps,
}: {
  reservationId: string;
  reason?: string;
  now?: Date;
  deps: {
    refund: (input: {
      reservationId: string;
      reason?: string;
      now?: Date;
    }) => Promise<TResult>;
  };
}): Promise<TResult> {
  return deps.refund({ reservationId, reason, now });
}
