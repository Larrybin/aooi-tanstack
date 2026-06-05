import 'server-only';

import { db } from '@/infra/adapters/db';
import { and, desc, eq, gt, inArray, isNull, lt, or } from 'drizzle-orm';

import { textToSpeechGeneration } from '@/config/db/schema';

export type TextToSpeechGeneration = typeof textToSpeechGeneration.$inferSelect;
export type NewTextToSpeechGeneration =
  typeof textToSpeechGeneration.$inferInsert;
export type UpdateTextToSpeechGeneration = Partial<
  Omit<NewTextToSpeechGeneration, 'id' | 'createdAt'>
>;

function ownerCondition({
  userId,
  anonymousSessionId,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
}) {
  if (userId) {
    if (!anonymousSessionId) {
      return eq(textToSpeechGeneration.userId, userId);
    }

    return or(
      eq(textToSpeechGeneration.userId, userId),
      and(
        isNull(textToSpeechGeneration.userId),
        eq(textToSpeechGeneration.anonymousSessionId, anonymousSessionId)
      )
    );
  }

  return and(
    isNull(textToSpeechGeneration.userId),
    anonymousSessionId
      ? eq(textToSpeechGeneration.anonymousSessionId, anonymousSessionId)
      : isNull(textToSpeechGeneration.anonymousSessionId)
  );
}

export async function createTextToSpeechGeneration(
  generation: NewTextToSpeechGeneration
) {
  const [created] = await db()
    .insert(textToSpeechGeneration)
    .values(generation)
    .returning();
  return created;
}

export async function findTextToSpeechGenerationById(id: string) {
  const [generation] = await db()
    .select()
    .from(textToSpeechGeneration)
    .where(
      and(
        eq(textToSpeechGeneration.id, id),
        isNull(textToSpeechGeneration.deletedAt)
      )
    )
    .limit(1);

  return generation;
}

export async function findReusableTextToSpeechGeneration({
  userId,
  anonymousSessionId,
  requestHash,
  now,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  requestHash: string;
  now: Date;
}) {
  const [generation] = await db()
    .select()
    .from(textToSpeechGeneration)
    .where(
      and(
        ownerCondition({ userId, anonymousSessionId }),
        eq(textToSpeechGeneration.requestHash, requestHash),
        eq(textToSpeechGeneration.status, 'generated'),
        gt(textToSpeechGeneration.expiresAt, now),
        isNull(textToSpeechGeneration.deletedAt)
      )
    )
    .orderBy(desc(textToSpeechGeneration.createdAt))
    .limit(1);

  return generation;
}

export async function listTextToSpeechGenerationsForOwner({
  userId,
  anonymousSessionId,
  limit,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  limit: number;
}) {
  return await db()
    .select()
    .from(textToSpeechGeneration)
    .where(
      and(
        ownerCondition({ userId, anonymousSessionId }),
        isNull(textToSpeechGeneration.deletedAt)
      )
    )
    .orderBy(desc(textToSpeechGeneration.createdAt))
    .limit(limit);
}

export async function deleteOverflowTextToSpeechGenerationsForOwner({
  userId,
  anonymousSessionId,
  keep,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  keep: number;
}) {
  const generations = await listTextToSpeechGenerationsForOwner({
    userId,
    anonymousSessionId,
    limit: Math.max(keep + 50, keep),
  });
  const overflow = generations.slice(keep);
  if (!overflow.length) {
    return [];
  }

  const now = new Date();
  return await db()
    .update(textToSpeechGeneration)
    .set({ status: 'deleted', deletedAt: now })
    .where(
      inArray(
        textToSpeechGeneration.id,
        overflow.map((generation) => generation.id)
      )
    )
    .returning();
}

export async function markExpiredTextToSpeechGenerations(now = new Date()) {
  return await db()
    .update(textToSpeechGeneration)
    .set({ status: 'expired' })
    .where(
      and(
        eq(textToSpeechGeneration.status, 'generated'),
        lt(textToSpeechGeneration.expiresAt, now),
        isNull(textToSpeechGeneration.deletedAt)
      )
    )
    .returning();
}
