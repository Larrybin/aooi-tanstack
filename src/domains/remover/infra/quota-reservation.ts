import 'server-only';

import type { ProductActor } from '@/domains/product-access/domain/actor';
import {
  commitProductQuota,
  refundProductQuota,
  reserveProductQuota,
  type ProductQuotaCheck,
  type ProductQuotaReservationDraft,
} from '@/domains/product-quota/application/quota-service';
import { db } from '@/infra/adapters/db';
import { and, eq, gt, gte, isNull, or, sql, sum } from 'drizzle-orm';

import { removerQuotaReservation } from '@/config/db/schema';
import { TooManyRequestsError } from '@/shared/lib/api/errors';

import {
  commitQuotaReservation,
  getRemoverQuotaTypeForOperationKey,
  isQuotaReservationReusable,
  refundQuotaReservation,
} from '../domain/quota';
import type {
  RemoverQuotaOperationKey,
  RemoverQuotaReservationStatus,
} from '../domain/types';

export type RemoverQuotaReservation =
  typeof removerQuotaReservation.$inferSelect;
export type NewRemoverQuotaReservation =
  typeof removerQuotaReservation.$inferInsert;

export type QuotaReservationCheck = {
  userId: string | null;
  anonymousSessionId: string | null;
  quotaType: string;
  windowStart: Date;
  limit: number;
  requestedUnits: number;
  now?: Date;
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
  return {
    id: reservation.id,
    userId: reservation.userId,
    anonymousSessionId: reservation.anonymousSessionId,
    productId: reservation.productId,
    quotaType: getRemoverQuotaTypeForOperationKey(
      reservation.operationKey as RemoverQuotaOperationKey
    ),
    units: reservation.units,
    status: reservation.status,
    idempotencyKey: reservation.idempotencyKey,
    jobId: reservation.jobId,
    reason: reservation.reason,
    entitlementGrantIdsJson: reservation.entitlementGrantIdsJson,
    expiresAt: reservation.expiresAt,
  };
}

export function toRemoverQuotaCheck(
  quota: ProductQuotaCheck
): QuotaReservationCheck {
  return {
    userId: quota.userId,
    anonymousSessionId: quota.anonymousSessionId,
    quotaType: getRemoverQuotaTypeForOperationKey(
      quota.operationKey as RemoverQuotaOperationKey
    ),
    windowStart: quota.windowStart,
    limit: quota.limit,
    requestedUnits: quota.requestedUnits,
    now: quota.now,
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
        createRemoverQuotaReservationWithQuotaCheck({
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
  return userId
    ? eq(removerQuotaReservation.userId, userId)
    : and(
        isNull(removerQuotaReservation.userId),
        anonymousSessionId
          ? eq(removerQuotaReservation.anonymousSessionId, anonymousSessionId)
          : isNull(removerQuotaReservation.anonymousSessionId)
      );
}

export function removerQuotaLockKey(quota: QuotaReservationCheck): string {
  const owner = quota.userId
    ? `user:${quota.userId}`
    : `anonymous:${quota.anonymousSessionId ?? 'none'}`;
  return `${owner}:${quota.quotaType}:${quota.windowStart.toISOString()}`;
}

function activeQuotaReservationCondition(now: Date) {
  return or(
    eq(removerQuotaReservation.status, 'committed'),
    and(
      eq(removerQuotaReservation.status, 'reserved'),
      gt(removerQuotaReservation.expiresAt, now)
    )
  );
}

function quotaUsageCondition(quota: {
  userId: string | null;
  anonymousSessionId: string | null;
  quotaType: string;
  windowStart: Date;
  now?: Date;
}) {
  return and(
    removerQuotaOwnerCondition(quota),
    eq(removerQuotaReservation.quotaType, quota.quotaType),
    activeQuotaReservationCondition(quota.now ?? new Date()),
    gte(removerQuotaReservation.createdAt, quota.windowStart)
  );
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
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('remover_idempotency'), hashtext(${idempotencyKey}))`
  );
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext('remover_quota'), hashtext(${removerQuotaLockKey(quota)}))`
  );
}

export async function assertRemoverQuotaAvailable(
  tx: RemoverDbTransaction,
  quota: QuotaReservationCheck
) {
  const [used] = await tx
    .select({ total: sum(removerQuotaReservation.units) })
    .from(removerQuotaReservation)
    .where(quotaUsageCondition(quota));
  const usedUnits = Number.parseInt(used?.total || '0', 10);
  if (usedUnits + quota.requestedUnits > quota.limit) {
    throw new TooManyRequestsError('remover quota exceeded', {
      limit: quota.limit,
      usedUnits,
      requestedUnits: quota.requestedUnits,
    });
  }
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
  await assertRemoverQuotaAvailable(tx, quota);

  const [createdReservation] = await tx
    .insert(removerQuotaReservation)
    .values(reservation)
    .returning();

  return createdReservation;
}

export async function findRemoverQuotaReservationByIdempotencyKey(
  idempotencyKey: string
) {
  const [reservation] = await db()
    .select()
    .from(removerQuotaReservation)
    .where(eq(removerQuotaReservation.idempotencyKey, idempotencyKey))
    .limit(1);

  return reservation;
}

export async function createRemoverQuotaReservation(
  newReservation: NewRemoverQuotaReservation
) {
  const [reservation] = await db()
    .insert(removerQuotaReservation)
    .values(newReservation)
    .returning();
  return reservation;
}

export async function createRemoverQuotaReservationWithQuotaCheck({
  reservation,
  quota,
}: {
  reservation: NewRemoverQuotaReservation;
  quota: QuotaReservationCheck;
}): Promise<{ reservation: RemoverQuotaReservation; reused: boolean }> {
  return db().transaction(async (tx) => {
    await lockRemoverQuotaReservationCreation(tx, {
      idempotencyKey: reservation.idempotencyKey,
      quota,
    });

    const [existingReservation] = await tx
      .select()
      .from(removerQuotaReservation)
      .where(
        eq(removerQuotaReservation.idempotencyKey, reservation.idempotencyKey)
      )
      .limit(1);
    if (existingReservation) {
      if (
        isQuotaReservationReusable({
          status: existingReservation.status,
          expiresAt: existingReservation.expiresAt,
          now: quota.now,
        })
      ) {
        return { reservation: existingReservation, reused: true };
      }

      await assertRemoverQuotaAvailable(tx, quota);
      const renewedAt = quota.now ?? new Date();
      const [renewedReservation] = await tx
        .update(removerQuotaReservation)
        .set({
          userId: reservation.userId ?? null,
          anonymousSessionId: reservation.anonymousSessionId ?? null,
          productId: reservation.productId,
          quotaType: reservation.quotaType,
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
        .where(eq(removerQuotaReservation.id, existingReservation.id))
        .returning();

      return { reservation: renewedReservation, reused: false };
    }

    const createdReservation =
      await insertRemoverQuotaReservationAfterQuotaCheck(tx, {
        reservation,
        quota,
      });

    return { reservation: createdReservation, reused: false };
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
  const [result] = await db()
    .select({ total: sum(removerQuotaReservation.units) })
    .from(removerQuotaReservation)
    .where(
      quotaUsageCondition({
        userId,
        anonymousSessionId,
        quotaType,
        windowStart,
        now,
      })
    );

  return Number.parseInt(result?.total || '0', 10);
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
  const [reservation] = await db()
    .update(removerQuotaReservation)
    .set({ userId })
    .where(
      and(
        eq(removerQuotaReservation.id, reservationId),
        isNull(removerQuotaReservation.userId),
        eq(removerQuotaReservation.anonymousSessionId, anonymousSessionId)
      )
    )
    .returning();

  return reservation;
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
  const [reservation] = await db()
    .update(removerQuotaReservation)
    .set({
      status,
      reason,
      committedAt: status === 'committed' ? now : null,
      refundedAt: status === 'refunded' ? now : null,
    })
    .where(eq(removerQuotaReservation.id, reservationId))
    .returning();

  return reservation;
}

async function commitRemoverQuotaReservationInStore({
  reservationId,
  now = new Date(),
}: {
  reservationId: string;
  now?: Date;
}) {
  return db().transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(removerQuotaReservation)
      .where(eq(removerQuotaReservation.id, reservationId))
      .limit(1)
      .for('update');

    if (!reservation) {
      return;
    }

    const nextStatus = commitQuotaReservation({
      status: reservation.status as RemoverQuotaReservationStatus,
    });
    if (reservation.status === nextStatus) {
      return reservation;
    }

    const [updated] = await tx
      .update(removerQuotaReservation)
      .set({
        status: nextStatus,
        committedAt: now,
      })
      .where(eq(removerQuotaReservation.id, reservation.id))
      .returning();

    return updated;
  });
}

export async function commitRemoverQuotaReservation({
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
      commit: commitRemoverQuotaReservationInStore,
    },
  });
}

async function refundRemoverQuotaReservationInStore({
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
      .from(removerQuotaReservation)
      .where(eq(removerQuotaReservation.id, reservationId))
      .limit(1)
      .for('update');

    if (!reservation) {
      return;
    }

    const nextStatus = refundQuotaReservation({
      status: reservation.status as RemoverQuotaReservationStatus,
    });
    if (reservation.status === nextStatus) {
      return reservation;
    }

    const [updated] = await tx
      .update(removerQuotaReservation)
      .set({
        status: nextStatus,
        reason,
        refundedAt: now,
      })
      .where(eq(removerQuotaReservation.id, reservation.id))
      .returning();

    return updated;
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
  return refundProductQuota({
    reservationId,
    reason,
    now,
    deps: {
      refund: refundRemoverQuotaReservationInStore,
    },
  });
}
