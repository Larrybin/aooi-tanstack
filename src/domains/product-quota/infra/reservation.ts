import 'server-only';

import {
  commitProductQuota,
  refundProductQuota,
  type ProductQuotaCheck,
  type ProductQuotaReservationDraft,
} from '@/domains/product-quota/application/quota-service';
import {
  commitProductQuotaReservation,
  isProductQuotaReservationReusable,
  refundProductQuotaReservation,
  type ProductQuotaReservationStatus,
} from '@/domains/product-quota/domain/reservation';
import { db } from '@/infra/adapters/db';
import { and, eq, gt, gte, isNull, or, sql, sum } from 'drizzle-orm';

import { productQuotaReservation } from '@/config/db/schema';
import { TooManyRequestsError } from '@/shared/lib/api/errors';

export type ProductQuotaReservation =
  typeof productQuotaReservation.$inferSelect;
export type NewProductQuotaReservation =
  typeof productQuotaReservation.$inferInsert;

export type ProductQuotaReservationCheck = ProductQuotaCheck & {
  quotaExceededMessage?: string;
};

type ProductQuotaDbTransaction = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

export function toProductQuotaReservationInsert(
  reservation: ProductQuotaReservationDraft
): NewProductQuotaReservation {
  return {
    id: reservation.id,
    userId: reservation.userId,
    anonymousSessionId: reservation.anonymousSessionId,
    siteKey: reservation.siteKey,
    productKey: reservation.productKey,
    productId: reservation.productId,
    operationKey: reservation.operationKey,
    units: reservation.units,
    status: reservation.status,
    idempotencyKey: reservation.idempotencyKey,
    jobId: reservation.jobId,
    reason: reservation.reason,
    entitlementGrantIdsJson: reservation.entitlementGrantIdsJson,
    expiresAt: reservation.expiresAt,
  };
}

export function productQuotaOwnerCondition({
  userId,
  anonymousSessionId,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
}) {
  return userId
    ? eq(productQuotaReservation.userId, userId)
    : and(
        isNull(productQuotaReservation.userId),
        anonymousSessionId
          ? eq(productQuotaReservation.anonymousSessionId, anonymousSessionId)
          : isNull(productQuotaReservation.anonymousSessionId)
      );
}

export function productQuotaLockKey(quota: ProductQuotaReservationCheck) {
  const owner = quota.userId
    ? `user:${quota.userId}`
    : `anonymous:${quota.anonymousSessionId ?? 'none'}`;
  return [
    owner,
    quota.siteKey,
    quota.productKey,
    quota.operationKey,
    quota.windowStart.toISOString(),
  ].join(':');
}

function activeProductQuotaReservationCondition(now: Date) {
  return or(
    eq(productQuotaReservation.status, 'committed'),
    and(
      eq(productQuotaReservation.status, 'reserved'),
      gt(productQuotaReservation.expiresAt, now)
    )
  );
}

function productQuotaUsageCondition(quota: ProductQuotaReservationCheck) {
  return and(
    productQuotaOwnerCondition(quota),
    eq(productQuotaReservation.siteKey, quota.siteKey),
    eq(productQuotaReservation.productKey, quota.productKey),
    eq(productQuotaReservation.operationKey, quota.operationKey),
    activeProductQuotaReservationCondition(quota.now ?? new Date()),
    gte(productQuotaReservation.createdAt, quota.windowStart)
  );
}

export async function lockProductQuotaReservationCreation(
  tx: ProductQuotaDbTransaction,
  {
    idempotencyKey,
    quota,
  }: {
    idempotencyKey: string;
    quota: ProductQuotaReservationCheck;
  }
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('product_quota_idempotency'), hashtext(${idempotencyKey}))`
  );
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('product_quota'), hashtext(${productQuotaLockKey(quota)}))`
  );
}

export async function assertProductQuotaReservationAvailable(
  tx: ProductQuotaDbTransaction,
  quota: ProductQuotaReservationCheck
) {
  const [used] = await tx
    .select({ total: sum(productQuotaReservation.units) })
    .from(productQuotaReservation)
    .where(productQuotaUsageCondition(quota));
  const usedUnits = Number.parseInt(used?.total || '0', 10);
  if (usedUnits + quota.requestedUnits > quota.limit) {
    throw new TooManyRequestsError(
      quota.quotaExceededMessage ?? 'product quota exceeded',
      {
        limit: quota.limit,
        usedUnits,
        requestedUnits: quota.requestedUnits,
      }
    );
  }
}

export async function insertProductQuotaReservationAfterQuotaCheck(
  tx: ProductQuotaDbTransaction,
  {
    reservation,
    quota,
  }: {
    reservation: NewProductQuotaReservation;
    quota: ProductQuotaReservationCheck;
  }
) {
  await assertProductQuotaReservationAvailable(tx, quota);

  const [createdReservation] = await tx
    .insert(productQuotaReservation)
    .values(reservation)
    .returning();

  return createdReservation;
}

export async function reserveProductQuotaReservationWithQuotaCheck({
  reservation,
  quota,
}: {
  reservation: NewProductQuotaReservation;
  quota: ProductQuotaReservationCheck;
}): Promise<{ reservation: ProductQuotaReservation; reused: boolean }> {
  return db().transaction(async (tx) => {
    await lockProductQuotaReservationCreation(tx, {
      idempotencyKey: reservation.idempotencyKey,
      quota,
    });

    const [existingReservation] = await tx
      .select()
      .from(productQuotaReservation)
      .where(
        eq(productQuotaReservation.idempotencyKey, reservation.idempotencyKey)
      )
      .limit(1);
    if (existingReservation) {
      if (
        isProductQuotaReservationReusable({
          status: existingReservation.status,
          expiresAt: existingReservation.expiresAt,
          now: quota.now,
        })
      ) {
        return { reservation: existingReservation, reused: true };
      }

      await assertProductQuotaReservationAvailable(tx, quota);
      const renewedAt = quota.now ?? new Date();
      const [renewedReservation] = await tx
        .update(productQuotaReservation)
        .set({
          userId: reservation.userId ?? null,
          anonymousSessionId: reservation.anonymousSessionId ?? null,
          siteKey: reservation.siteKey,
          productKey: reservation.productKey,
          productId: reservation.productId,
          operationKey: reservation.operationKey,
          units: reservation.units,
          status: reservation.status,
          jobId: reservation.jobId ?? null,
          reason: reservation.reason ?? null,
          entitlementGrantIdsJson: reservation.entitlementGrantIdsJson ?? null,
          createdAt: renewedAt,
          committedAt: null,
          refundedAt: null,
          expiresAt: reservation.expiresAt,
        })
        .where(eq(productQuotaReservation.id, existingReservation.id))
        .returning();

      return { reservation: renewedReservation, reused: false };
    }

    const createdReservation =
      await insertProductQuotaReservationAfterQuotaCheck(tx, {
        reservation,
        quota,
      });

    return { reservation: createdReservation, reused: false };
  });
}

export async function findProductQuotaReservationByIdempotencyKey(
  idempotencyKey: string
) {
  const [reservation] = await db()
    .select()
    .from(productQuotaReservation)
    .where(eq(productQuotaReservation.idempotencyKey, idempotencyKey))
    .limit(1);

  return reservation;
}

export async function countActiveProductQuotaUnits({
  userId,
  anonymousSessionId,
  siteKey,
  productKey,
  operationKey,
  windowStart,
  now,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  siteKey: string;
  productKey: string;
  operationKey: string;
  windowStart: Date;
  now?: Date;
}): Promise<number> {
  const [result] = await db()
    .select({ total: sum(productQuotaReservation.units) })
    .from(productQuotaReservation)
    .where(
      productQuotaUsageCondition({
        userId,
        anonymousSessionId,
        siteKey,
        productKey,
        operationKey,
        windowStart,
        limit: Number.MAX_SAFE_INTEGER,
        requestedUnits: 0,
        now,
      })
    );

  return Number.parseInt(result?.total || '0', 10);
}

export async function claimProductQuotaReservationById({
  reservationId,
  userId,
  anonymousSessionId,
}: {
  reservationId: string;
  userId: string;
  anonymousSessionId: string;
}) {
  const [reservation] = await db()
    .update(productQuotaReservation)
    .set({ userId })
    .where(
      and(
        eq(productQuotaReservation.id, reservationId),
        isNull(productQuotaReservation.userId),
        eq(productQuotaReservation.anonymousSessionId, anonymousSessionId)
      )
    )
    .returning();

  return reservation;
}

export async function updateProductQuotaReservationStatus({
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
  const [reservation] = await db()
    .update(productQuotaReservation)
    .set({
      status,
      reason,
      committedAt: status === 'committed' ? now : null,
      refundedAt: status === 'refunded' ? now : null,
    })
    .where(eq(productQuotaReservation.id, reservationId))
    .returning();

  return reservation;
}

async function commitProductQuotaReservationInStore({
  reservationId,
  now = new Date(),
}: {
  reservationId: string;
  now?: Date;
}) {
  return db().transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(productQuotaReservation)
      .where(eq(productQuotaReservation.id, reservationId))
      .limit(1)
      .for('update');

    if (!reservation) {
      return;
    }

    const nextStatus = commitProductQuotaReservation({
      status: reservation.status as ProductQuotaReservationStatus,
    });
    if (reservation.status === nextStatus) {
      return reservation;
    }

    const [updated] = await tx
      .update(productQuotaReservation)
      .set({
        status: nextStatus,
        committedAt: now,
      })
      .where(eq(productQuotaReservation.id, reservation.id))
      .returning();

    return updated;
  });
}

export async function commitProductQuotaReservationById({
  reservationId,
  now,
}: {
  reservationId: string;
  now?: Date;
}) {
  return commitProductQuota({
    reservationId,
    now,
    deps: {
      commit: commitProductQuotaReservationInStore,
    },
  });
}

async function refundProductQuotaReservationInStore({
  reservationId,
  reason,
  now = new Date(),
}: {
  reservationId: string;
  reason?: string;
  now?: Date;
}) {
  return db().transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(productQuotaReservation)
      .where(eq(productQuotaReservation.id, reservationId))
      .limit(1)
      .for('update');

    if (!reservation) {
      return;
    }

    const nextStatus = refundProductQuotaReservation({
      status: reservation.status as ProductQuotaReservationStatus,
    });
    if (reservation.status === nextStatus) {
      return reservation;
    }

    const [updated] = await tx
      .update(productQuotaReservation)
      .set({
        status: nextStatus,
        reason,
        refundedAt: now,
      })
      .where(eq(productQuotaReservation.id, reservation.id))
      .returning();

    return updated;
  });
}

export async function refundProductQuotaReservationById({
  reservationId,
  reason,
  now,
}: {
  reservationId: string;
  reason?: string;
  now?: Date;
}) {
  return refundProductQuota({
    reservationId,
    reason,
    now,
    deps: {
      refund: refundProductQuotaReservationInStore,
    },
  });
}
