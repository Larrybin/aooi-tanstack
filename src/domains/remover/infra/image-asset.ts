import 'server-only';

import { db } from '@/infra/adapters/db';
import { and, eq, gte, inArray, isNull, lte } from 'drizzle-orm';

import { removerImageAsset } from '@/config/db/schema';

export type RemoverImageAsset = typeof removerImageAsset.$inferSelect;
export type NewRemoverImageAsset = typeof removerImageAsset.$inferInsert;

export async function createRemoverImageAsset(
  newAsset: NewRemoverImageAsset
) {
  const [asset] = await db()
    .insert(removerImageAsset)
    .values(newAsset)
    .returning();
  return asset;
}

export async function createRemoverImageAssets(
  newAssets: NewRemoverImageAsset[]
) {
  if (!newAssets.length) {
    return [];
  }

  return db().transaction((tx) =>
    tx.insert(removerImageAsset).values(newAssets).returning()
  );
}

export async function findActiveRemoverImageAssetById(id: string) {
  const [asset] = await db()
    .select()
    .from(removerImageAsset)
    .where(
      and(
        eq(removerImageAsset.id, id),
        eq(removerImageAsset.status, 'active'),
        isNull(removerImageAsset.deletedAt)
      )
    )
    .limit(1);

  return asset;
}

export async function countActiveRemoverImageAssetsForOwner({
  userId,
  anonymousSessionId,
  windowStart,
}: {
  userId: string | null;
  anonymousSessionId: string | null;
  windowStart: Date;
}) {
  const ownerCondition = userId
    ? eq(removerImageAsset.userId, userId)
    : and(
        isNull(removerImageAsset.userId),
        anonymousSessionId
          ? eq(removerImageAsset.anonymousSessionId, anonymousSessionId)
          : isNull(removerImageAsset.anonymousSessionId)
      );

  const assets = await db()
    .select({ id: removerImageAsset.id })
    .from(removerImageAsset)
    .where(
      and(
        ownerCondition,
        inArray(removerImageAsset.kind, ['original', 'mask']),
        eq(removerImageAsset.status, 'active'),
        isNull(removerImageAsset.deletedAt),
        gte(removerImageAsset.createdAt, windowStart)
      )
    );

  return assets.length;
}

export async function claimRemoverImageAssetsByKeys({
  storageKeys,
  userId,
  anonymousSessionId,
}: {
  storageKeys: string[];
  userId: string;
  anonymousSessionId: string;
}) {
  const keys = storageKeys.filter(Boolean);
  if (!keys.length) {
    return [];
  }

  return db()
    .update(removerImageAsset)
    .set({ userId })
    .where(
      and(
        isNull(removerImageAsset.userId),
        eq(removerImageAsset.anonymousSessionId, anonymousSessionId),
        inArray(removerImageAsset.storageKey, keys),
        isNull(removerImageAsset.deletedAt)
      )
    )
    .returning();
}

export async function markRemoverImageAssetsDeletedByKeys({
  storageKeys,
  userId,
  now = new Date(),
}: {
  storageKeys: string[];
  userId: string;
  now?: Date;
}) {
  const keys = storageKeys.filter(Boolean);
  if (!keys.length) {
    return [];
  }

  return db()
    .update(removerImageAsset)
    .set({
      status: 'deleted',
      deletedAt: now,
    })
    .where(
      and(
        eq(removerImageAsset.userId, userId),
        inArray(removerImageAsset.storageKey, keys),
        isNull(removerImageAsset.deletedAt)
      )
    )
    .returning();
}

export async function listExpiredRemoverImageAssets({
  now,
  limit = 200,
}: {
  now: Date;
  limit?: number;
}) {
  return db()
    .select()
    .from(removerImageAsset)
    .where(
      and(
        eq(removerImageAsset.status, 'active'),
        lte(removerImageAsset.expiresAt, now),
        isNull(removerImageAsset.deletedAt)
      )
    )
    .limit(limit);
}

export async function markRemoverImageAssetsDeletedByKeysAnyOwner({
  storageKeys,
  now = new Date(),
}: {
  storageKeys: string[];
  now?: Date;
}) {
  const keys = storageKeys.filter(Boolean);
  if (!keys.length) {
    return [];
  }

  return db()
    .update(removerImageAsset)
    .set({
      status: 'deleted',
      deletedAt: now,
    })
    .where(
      and(
        inArray(removerImageAsset.storageKey, keys),
        isNull(removerImageAsset.deletedAt)
      )
    )
    .returning();
}
