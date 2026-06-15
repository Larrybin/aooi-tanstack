
import { appendUserToResult, type User } from '@/domains/account/infra/user';
import { db } from '@/infra/adapters/db';
import { and, count, desc, eq, or, type SQL } from 'drizzle-orm';

import { chat } from '@/config/db/schema';

export type Chat = typeof chat.$inferSelect & {
  user?: User;
};
export type NewChat = typeof chat.$inferInsert;
export type UpdateChat = Partial<Omit<NewChat, 'id' | 'createdAt'>>;

export enum ChatStatus {
  PENDING = 'pending',
  CREATED = 'created',
  DELETED = 'deleted',
}

export async function createChat(newChat: NewChat): Promise<Chat> {
  const [result] = await db().insert(chat).values(newChat).returning();

  return result;
}

export async function getChats({
  userId,
  status,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  status?: ChatStatus;
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<Chat[]> {
  const result = await db()
    .select()
    .from(chat)
    .where(
      and(
        userId ? eq(chat.userId, userId) : undefined,
        status ? eq(chat.status, status) : undefined
      )
    )
    .orderBy(desc(chat.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

export async function getChatsCount({
  userId,
  status,
}: {
  userId?: string;
  status?: ChatStatus;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(chat)
    .where(
      and(
        userId ? eq(chat.userId, userId) : undefined,
        status ? eq(chat.status, status) : undefined
      )
    );

  return result?.count || 0;
}

export async function findChatById(id: string): Promise<Chat | undefined> {
  const [result] = await db()
    .select()
    .from(chat)
    .where(eq(chat.id, id))
    .limit(1);

  return result;
}

export async function findChatByIdForViewer(params: {
  chatId: string;
  viewerUserId: string;
  allowAccessCondition?: SQL;
}): Promise<Chat | undefined> {
  const [result] = await db()
    .select()
    .from(chat)
    .where(
      and(
        eq(chat.id, params.chatId),
        or(eq(chat.userId, params.viewerUserId), params.allowAccessCondition)
      )
    )
    .limit(1);

  return result;
}

export async function updateChat(
  id: string,
  updateChat: UpdateChat
): Promise<Chat> {
  const [result] = await db()
    .update(chat)
    .set(updateChat)
    .where(eq(chat.id, id))
    .returning();

  return result;
}
