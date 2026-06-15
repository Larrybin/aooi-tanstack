
import { db } from '@/infra/adapters/db';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNull,
  or,
  sql,
  sum,
} from 'drizzle-orm';

import { credit } from '@/config/db/schema';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import { safeJsonParse } from '@/shared/lib/json';

import { appendUserToResult, type User } from './user';

export type Credit = typeof credit.$inferSelect & {
  user?: User;
};
export type NewCredit = typeof credit.$inferInsert;
export type UpdateCredit = Partial<
  Omit<NewCredit, 'id' | 'transactionNo' | 'createdAt'>
>;

export enum CreditStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  DELETED = 'deleted',
}

export enum CreditTransactionType {
  GRANT = 'grant', // grant credit
  CONSUME = 'consume', // consume credit
}

export enum CreditTransactionScene {
  PAYMENT = 'payment', // payment
  SUBSCRIPTION = 'subscription', // subscription
  RENEWAL = 'renewal', // renewal
  GIFT = 'gift', // gift
  AWARD = 'award', // award
}

// Calculate credit expiration time based on order and subscription info
export function calculateCreditExpirationTime({
  creditsValidDays,
  currentPeriodEnd,
}: {
  creditsValidDays: number;
  currentPeriodEnd?: Date;
}): Date | null {
  const now = new Date();

  // Check if credits should never expire
  if (!creditsValidDays || creditsValidDays <= 0) {
    // never expires
    return null;
  }

  const expiresAt = new Date();

  if (currentPeriodEnd) {
    // For subscription: credits expire at the end of current period
    expiresAt.setTime(currentPeriodEnd.getTime());
  } else {
    // For one-time payment: use configured validity days
    expiresAt.setDate(now.getDate() + creditsValidDays);
  }

  return expiresAt;
}

// Helper function to create expiration condition for queries
export function createExpirationCondition() {
  const currentTime = new Date();
  // Credit is valid if: expires_at IS NULL OR expires_at > current_time
  return or(isNull(credit.expiresAt), gt(credit.expiresAt, currentTime));
}

// create credit
export async function createCredit(newCredit: NewCredit) {
  const [result] = await db().insert(credit).values(newCredit).returning();
  return result;
}

// get credits
export async function getCredits({
  userId,
  status,
  transactionType,
  getUser = false,
  page = 1,
  limit = 30,
}: {
  userId?: string;
  status?: CreditStatus;
  transactionType?: CreditTransactionType;
  getUser?: boolean;
  page?: number;
  limit?: number;
}): Promise<Credit[]> {
  const result = await db()
    .select()
    .from(credit)
    .where(
      and(
        userId ? eq(credit.userId, userId) : undefined,
        status ? eq(credit.status, status) : undefined,
        transactionType
          ? eq(credit.transactionType, transactionType)
          : undefined
      )
    )
    .orderBy(desc(credit.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

// get credits count
export async function getCreditsCount({
  userId,
  status,
  transactionType,
}: {
  userId?: string;
  status?: CreditStatus;
  transactionType?: CreditTransactionType;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(credit)
    .where(
      and(
        userId ? eq(credit.userId, userId) : undefined,
        status ? eq(credit.status, status) : undefined,
        transactionType
          ? eq(credit.transactionType, transactionType)
          : undefined
      )
    );

  return result?.count || 0;
}

// consume credits
export async function consumeCredits({
  userId,
  credits,
  scene,
  description,
  metadata,
}: {
  userId: string;
  credits: number; // credits to consume
  scene?: string;
  description?: string;
  metadata?: string;
}) {
  const currentTime = new Date();

  // consume credits
  const result = await db().transaction(async (tx) => {
    // 1. check credits balance
    const [creditsBalance] = await tx
      .select({
        total: sum(credit.remainingCredits),
      })
      .from(credit)
      .where(
        and(
          eq(credit.userId, userId),
          eq(credit.transactionType, CreditTransactionType.GRANT),
          eq(credit.status, CreditStatus.ACTIVE),
          gt(credit.remainingCredits, 0),
          or(
            isNull(credit.expiresAt), // Never expires
            gt(credit.expiresAt, currentTime) // Not yet expired
          )
        )
      );

    // balance is not enough
    if (
      !creditsBalance ||
      !creditsBalance.total ||
      parseInt(creditsBalance.total) < credits
    ) {
      throw new Error(
        `Insufficient credits, ${creditsBalance?.total || 0} < ${credits}`
      );
    }

    // 2. get available credits, FIFO queue with expiresAt, batch query
    let remainingToConsume = credits; // remaining credits to consume

    // only deal with 10000 credit grant records
    let batchNo = 0; // batch no
    const maxBatchNo = 10; // max batch no
    const batchSize = 1000; // batch size
    type ConsumedItem = {
      creditId: string;
      transactionNo: string;
      expiresAt: Date | null;
      creditsToConsume: number;
      creditsConsumed: number;
      creditsBefore: number;
      creditsAfter: number;
      batchSize: number;
      batchNo: number;
    };

    const consumedItems: ConsumedItem[] = [];

    while (remainingToConsume > 0) {
      batchNo += 1;

      // if too many batches, throw error
      if (batchNo > maxBatchNo) {
        throw new Error(`Too many batches: ${batchNo} > ${maxBatchNo}`);
      }

      // get batch credits
      const batchCredits = await tx
        .select()
        .from(credit)
        .where(
          and(
            eq(credit.userId, userId),
            eq(credit.transactionType, CreditTransactionType.GRANT),
            eq(credit.status, CreditStatus.ACTIVE),
            gt(credit.remainingCredits, 0),
            or(
              isNull(credit.expiresAt), // Never expires
              gt(credit.expiresAt, currentTime) // Not yet expired
            )
          )
        )
        .orderBy(
          // FIFO queue: expired credits first, then by expiration date
          // NULL values (never expires) will be ordered last
          sql`${credit.expiresAt} asc nulls last`,
          asc(credit.createdAt)
        )
        .limit(batchSize) // batch size
        .for('update'); // lock for update

      // no more credits
      if (batchCredits?.length === 0) {
        break;
      }

      // consume credits for each item
      for (const item of batchCredits) {
        // no need to consume more
        if (remainingToConsume <= 0) {
          break;
        }
        const toConsume = Math.min(remainingToConsume, item.remainingCredits);

        // update remaining credits
        await tx
          .update(credit)
          .set({ remainingCredits: item.remainingCredits - toConsume })
          .where(eq(credit.id, item.id));

        // update consumed items
        consumedItems.push({
          creditId: item.id,
          transactionNo: item.transactionNo,
          expiresAt: item.expiresAt,
          creditsToConsume: remainingToConsume,
          creditsConsumed: toConsume,
          creditsBefore: item.remainingCredits,
          creditsAfter: item.remainingCredits - toConsume,
          batchSize: batchSize,
          batchNo: batchNo,
        });

        remainingToConsume -= toConsume;
      }
    }

    if (remainingToConsume > 0) {
      throw new Error(
        `Insufficient credits during consume, ${credits - remainingToConsume} < ${credits}`
      );
    }

    // 3. create consumed credit
    const consumedCredit: NewCredit = {
      id: getUuid(),
      transactionNo: getSnowId(),
      transactionType: CreditTransactionType.CONSUME,
      transactionScene: scene,
      userId: userId,
      status: CreditStatus.ACTIVE,
      description: description,
      credits: -credits,
      consumedDetail: JSON.stringify(consumedItems),
      metadata: metadata,
    };
    await tx.insert(credit).values(consumedCredit);

    return consumedCredit;
  });

  return result;
}

// get remaining credits
export async function getRemainingCredits(userId: string): Promise<number> {
  const currentTime = new Date();

  const [result] = await db()
    .select({
      total: sum(credit.remainingCredits),
    })
    .from(credit)
    .where(
      and(
        eq(credit.userId, userId),
        eq(credit.transactionType, CreditTransactionType.GRANT),
        eq(credit.status, CreditStatus.ACTIVE),
        gt(credit.remainingCredits, 0),
        or(
          isNull(credit.expiresAt), // Never expires
          gt(credit.expiresAt, currentTime) // Not yet expired
        )
      )
    );

  return parseInt(result?.total || '0');
}

export async function getRemainingCreditsSummary(
  userId: string
): Promise<{ remainingCredits: number; expiresAt: string | null }> {
  const currentTime = new Date();

  const [result] = await db()
    .select({
      total: sum(credit.remainingCredits),
      expiresAt: sql<Date | null>`min(${credit.expiresAt})`,
    })
    .from(credit)
    .where(
      and(
        eq(credit.userId, userId),
        eq(credit.transactionType, CreditTransactionType.GRANT),
        eq(credit.status, CreditStatus.ACTIVE),
        gt(credit.remainingCredits, 0),
        or(
          isNull(credit.expiresAt), // Never expires
          gt(credit.expiresAt, currentTime) // Not yet expired
        )
      )
    );

  return {
    remainingCredits: parseInt(result?.total || '0'),
    expiresAt: result?.expiresAt
      ? new Date(result.expiresAt).toISOString()
      : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isConsumedItem(
  value: unknown
): value is { creditId: string; creditsConsumed: number } {
  if (!isRecord(value)) return false;
  return (
    typeof value.creditId === 'string' &&
    typeof value.creditsConsumed === 'number' &&
    value.creditsConsumed > 0
  );
}

export type RefundConsumedCreditResult =
  | { refunded: true }
  | {
      refunded: false;
      reason:
        | 'not_found'
        | 'not_consume'
        | 'not_active'
        | 'invalid_consumed_detail';
    };

type DbTransactionClient = Parameters<
  Parameters<ReturnType<typeof db>['transaction']>[0]
>[0];

async function refundConsumedCreditByIdInClient(
  tx: DbTransactionClient,
  creditId: string
): Promise<RefundConsumedCreditResult> {
  const [consumedCredit] = await tx
    .select()
    .from(credit)
    .where(eq(credit.id, creditId))
    .limit(1)
    .for('update');

  if (!consumedCredit) {
    return { refunded: false, reason: 'not_found' };
  }

  if (consumedCredit.transactionType !== CreditTransactionType.CONSUME) {
    return { refunded: false, reason: 'not_consume' };
  }

  if (consumedCredit.status !== CreditStatus.ACTIVE) {
    return { refunded: false, reason: 'not_active' };
  }

  const consumedItemsRaw = safeJsonParse<unknown>(
    consumedCredit.consumedDetail
  );
  if (!Array.isArray(consumedItemsRaw) || consumedItemsRaw.length === 0) {
    return { refunded: false, reason: 'invalid_consumed_detail' };
  }

  const consumedItems: Array<{ creditId: string; creditsConsumed: number }> =
    [];
  for (const item of consumedItemsRaw) {
    if (!isConsumedItem(item)) {
      return { refunded: false, reason: 'invalid_consumed_detail' };
    }
    consumedItems.push(item);
  }

  const expectedCredits = Math.abs(consumedCredit.credits || 0);
  const consumedCreditsTotal = consumedItems.reduce(
    (sum, item) => sum + item.creditsConsumed,
    0
  );

  if (expectedCredits <= 0 || consumedCreditsTotal !== expectedCredits) {
    return { refunded: false, reason: 'invalid_consumed_detail' };
  }

  await Promise.all(
    consumedItems.map((item) =>
      tx
        .update(credit)
        .set({
          remainingCredits: sql`${credit.remainingCredits} + ${item.creditsConsumed}`,
        })
        .where(eq(credit.id, item.creditId))
    )
  );

  await tx
    .update(credit)
    .set({
      status: CreditStatus.DELETED,
    })
    .where(eq(credit.id, creditId));

  return { refunded: true };
}

export async function refundConsumedCreditById(
  creditId: string,
  tx?: DbTransactionClient
): Promise<RefundConsumedCreditResult> {
  const trimmed = creditId?.trim();
  if (!trimmed) {
    return { refunded: false, reason: 'not_found' };
  }

  if (tx) {
    return refundConsumedCreditByIdInClient(tx, trimmed);
  }

  return db().transaction(async (dbTx) =>
    refundConsumedCreditByIdInClient(dbTx, trimmed)
  );
}
