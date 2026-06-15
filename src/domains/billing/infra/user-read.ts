
import { db } from '@/infra/adapters/db';
import { eq, inArray } from 'drizzle-orm';

import { user } from '@/config/db/schema';

export type BillingUser = typeof user.$inferSelect;
export type WithUserId = {
  userId: string;
};
export type WithAttachedUser<T extends WithUserId> = T & {
  user: BillingUser | undefined;
};

export async function appendBillingUserToResult<T extends WithUserId>(
  rows: T[]
): Promise<WithAttachedUser<T>[]> {
  if (rows.length === 0) {
    return rows as WithAttachedUser<T>[];
  }

  const users = await db()
    .select()
    .from(user)
    .where(
      inArray(
        user.id,
        rows.map((item) => item.userId)
      )
    );

  return rows.map((item) => ({
    ...item,
    user: users.find((candidate) => candidate.id === item.userId),
  }));
}

export async function findBillingUserById(userId: string) {
  const [result] = await db().select().from(user).where(eq(user.id, userId));
  return result;
}
