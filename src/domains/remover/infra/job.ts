import 'server-only';

import { db } from '@/infra/adapters/db';
import { and, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { removerJob, removerQuotaReservation } from '@/config/db/schema';
import { ConflictError } from '@/shared/lib/api/errors';

import {
  insertRemoverQuotaReservationAfterQuotaCheck,
  lockRemoverQuotaReservationCreation,
  type NewRemoverQuotaReservation,
  type QuotaReservationCheck,
  type RemoverQuotaReservation,
} from './quota-reservation';

export type RemoverJob = typeof removerJob.$inferSelect;
export type NewRemoverJob = typeof removerJob.$inferInsert;
export type UpdateRemoverJob = Partial<Omit<NewRemoverJob, 'id' | 'createdAt'>>;

export async function withRemoverJobOutputStorageLock<T>(
  jobId: string,
  callback: () => Promise<T>
): Promise<T> {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('remover_job_output'), hashtext(${jobId}))`
    );
    return callback();
  });
}

export async function createRemoverJobWithQuotaReservation({
  reservation,
  job,
  quota,
}: {
  reservation: NewRemoverQuotaReservation;
  job: NewRemoverJob;
  quota: QuotaReservationCheck;
}): Promise<{
  reservation: RemoverQuotaReservation;
  job: RemoverJob;
  reused: boolean;
}> {
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
      const [existingJob] = await tx
        .select()
        .from(removerJob)
        .where(
          and(
            eq(removerJob.quotaReservationId, existingReservation.id),
            isNull(removerJob.deletedAt)
          )
        )
        .limit(1);
      if (!existingJob) {
        throw new ConflictError(
          'quota reservation already exists without an active job'
        );
      }

      return {
        reservation: existingReservation,
        job: existingJob,
        reused: true,
      };
    }

    const createdReservation =
      await insertRemoverQuotaReservationAfterQuotaCheck(tx, {
        reservation,
        quota,
      });
    const [createdJob] = await tx.insert(removerJob).values(job).returning();
    const [attachedReservation] = await tx
      .update(removerQuotaReservation)
      .set({ jobId: createdJob.id })
      .where(eq(removerQuotaReservation.id, createdReservation.id))
      .returning();

    return {
      reservation: attachedReservation,
      job: createdJob,
      reused: false,
    };
  });
}

export async function findRemoverJobById(id: string) {
  const [job] = await db()
    .select()
    .from(removerJob)
    .where(and(eq(removerJob.id, id), isNull(removerJob.deletedAt)))
    .limit(1);

  return job;
}

export async function findRemoverJobByQuotaReservationId(
  quotaReservationId: string
) {
  const [job] = await db()
    .select()
    .from(removerJob)
    .where(
      and(
        eq(removerJob.quotaReservationId, quotaReservationId),
        isNull(removerJob.deletedAt)
      )
    )
    .limit(1);

  return job;
}

export async function updateRemoverJobById(
  id: string,
  updateJob: UpdateRemoverJob
) {
  const [job] = await db()
    .update(removerJob)
    .set(updateJob)
    .where(eq(removerJob.id, id))
    .returning();

  return job;
}

export async function claimRemoverJobForProviderSubmission({
  id,
  staleBefore,
}: {
  id: string;
  staleBefore: Date;
}) {
  const [job] = await db()
    .update(removerJob)
    .set({ status: 'processing' })
    .where(
      and(
        eq(removerJob.id, id),
        or(
          eq(removerJob.status, 'queued'),
          and(
            eq(removerJob.status, 'processing'),
            lte(removerJob.updatedAt, staleBefore)
          )
        ),
        isNull(removerJob.providerTaskId),
        isNull(removerJob.deletedAt)
      )
    )
    .returning();

  return job;
}

export async function listRemoverJobsForOwner({
  userId,
  anonymousSessionId,
  limit = 30,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  limit?: number;
}) {
  const ownerCondition = userId
    ? eq(removerJob.userId, userId)
    : and(
        isNull(removerJob.userId),
        anonymousSessionId
          ? eq(removerJob.anonymousSessionId, anonymousSessionId)
          : isNull(removerJob.anonymousSessionId)
      );

  return db()
    .select()
    .from(removerJob)
    .where(and(ownerCondition, isNull(removerJob.deletedAt)))
    .orderBy(desc(removerJob.createdAt))
    .limit(limit);
}

export async function claimRemoverJobById({
  id,
  userId,
  anonymousSessionId,
}: {
  id: string;
  userId: string;
  anonymousSessionId: string;
}) {
  const [job] = await db()
    .update(removerJob)
    .set({ userId })
    .where(
      and(
        eq(removerJob.id, id),
        isNull(removerJob.userId),
        eq(removerJob.anonymousSessionId, anonymousSessionId),
        isNull(removerJob.deletedAt)
      )
    )
    .returning();

  return job;
}

export async function markRemoverJobDeletedById({
  id,
  userId,
  now = new Date(),
}: {
  id: string;
  userId: string;
  now?: Date;
}) {
  const [job] = await db()
    .update(removerJob)
    .set({ deletedAt: now })
    .where(
      and(
        eq(removerJob.id, id),
        eq(removerJob.userId, userId),
        isNull(removerJob.deletedAt)
      )
    )
    .returning();

  return job;
}

export async function listExpiredRemoverJobs({
  now,
  limit = 100,
}: {
  now: Date;
  limit?: number;
}) {
  return db()
    .select()
    .from(removerJob)
    .where(and(lte(removerJob.expiresAt, now), isNull(removerJob.deletedAt)))
    .orderBy(desc(removerJob.expiresAt))
    .limit(limit);
}

export async function markRemoverJobsDeletedByIds({
  ids,
  now = new Date(),
}: {
  ids: string[];
  now?: Date;
}) {
  const jobIds = ids.filter(Boolean);
  if (!jobIds.length) {
    return [];
  }

  return db()
    .update(removerJob)
    .set({ deletedAt: now })
    .where(and(inArray(removerJob.id, jobIds), isNull(removerJob.deletedAt)))
    .returning();
}
