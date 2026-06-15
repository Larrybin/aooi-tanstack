
import { db } from '@/infra/adapters/db';
import { count, desc, eq, inArray } from 'drizzle-orm';

import { user } from '@/config/db/schema';

export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type UpdateUser = Partial<Omit<NewUser, 'id' | 'createdAt' | 'email'>>;

export async function updateUser(userId: string, updatedUser: UpdateUser) {
  const [result] = await db()
    .update(user)
    .set(updatedUser)
    .where(eq(user.id, userId))
    .returning();

  return result;
}

export async function findUserById(userId: string) {
  const [result] = await db().select().from(user).where(eq(user.id, userId));

  return result;
}

export async function getUsers({
  page = 1,
  limit = 30,
  email,
}: {
  email?: string;
  page?: number;
  limit?: number;
} = {}): Promise<User[]> {
  const result = await db()
    .select()
    .from(user)
    .where(email ? eq(user.email, email) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return result;
}

export async function getUsersCount({ email }: { email?: string }) {
  const [result] = await db()
    .select({ count: count() })
    .from(user)
    .where(email ? eq(user.email, email) : undefined);
  return result?.count || 0;
}

export async function getUserByUserIds(userIds: string[]) {
  const result = await db()
    .select()
    .from(user)
    .where(inArray(user.id, userIds));

  return result;
}

export type WithUserId = {
  userId: string;
};

export type WithAttachedUser<T extends WithUserId> = T & {
  user: User | undefined;
};

export async function appendUserToResult<T extends WithUserId>(
  result: T[]
): Promise<WithAttachedUser<T>[]> {
  if (!result || result.length === 0) {
    return result as WithAttachedUser<T>[];
  }

  const userIds = result.map((item) => item.userId);
  const users = await getUserByUserIds(userIds);

  return result.map((item) => {
    const attachedUser = users.find((u) => u.id === item.userId);
    return { ...item, user: attachedUser };
  });
}
