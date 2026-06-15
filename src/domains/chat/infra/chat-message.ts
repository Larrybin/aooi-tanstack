
import { appendUserToResult, type User } from '@/domains/account/infra/user';
import { db } from '@/infra/adapters/db';
import { and, asc, count, desc, eq } from 'drizzle-orm';

import { chatMessage } from '@/config/db/schema';

import type { Chat } from './chat';

export enum ChatMessageStatus {
  CREATED = 'created',
  DELETED = 'deleted',
}

export type ChatMessage = typeof chatMessage.$inferSelect & {
  user?: User;
  chat?: Chat;
};
export type NewChatMessage = typeof chatMessage.$inferInsert;
export type UpdateChatMessage = Partial<
  Omit<NewChatMessage, 'id' | 'createdAt'>
>;

export async function createChatMessage(
  newChatMessage: NewChatMessage
): Promise<ChatMessage> {
  const [result] = await db()
    .insert(chatMessage)
    .values(newChatMessage)
    .returning();

  return result;
}

export async function getChatMessages({
  userId,
  chatId,
  status,
  page = 1,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  chatId: string;
  status?: ChatMessageStatus;
  page?: number;
  limit?: number;
  getUser?: boolean;
}): Promise<ChatMessage[]> {
  const result = await db()
    .select()
    .from(chatMessage)
    .where(
      and(
        userId ? eq(chatMessage.userId, userId) : undefined,
        chatId ? eq(chatMessage.chatId, chatId) : undefined,
        status ? eq(chatMessage.status, status) : undefined
      )
    )
    .orderBy(asc(chatMessage.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

export async function getChatMessageWindow({
  userId,
  chatId,
  status,
  limit = 30,
  getUser = false,
}: {
  userId?: string;
  chatId: string;
  status?: ChatMessageStatus;
  limit?: number;
  getUser?: boolean;
}): Promise<ChatMessage[]> {
  const result = await db()
    .select()
    .from(chatMessage)
    .where(
      and(
        userId ? eq(chatMessage.userId, userId) : undefined,
        chatId ? eq(chatMessage.chatId, chatId) : undefined,
        status ? eq(chatMessage.status, status) : undefined
      )
    )
    .orderBy(desc(chatMessage.createdAt))
    .limit(limit);

  const ordered = result.reverse();

  if (getUser) {
    return appendUserToResult(ordered);
  }

  return ordered;
}

export async function getChatMessagesCount({
  userId,
  chatId,
  status,
}: {
  userId?: string;
  chatId: string;
  status?: ChatMessageStatus;
}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(chatMessage)
    .where(
      and(
        userId ? eq(chatMessage.userId, userId) : undefined,
        chatId ? eq(chatMessage.chatId, chatId) : undefined,
        status ? eq(chatMessage.status, status) : undefined
      )
    );

  return result?.count || 0;
}

export async function findChatMessageById(
  id: string
): Promise<ChatMessage | undefined> {
  const [result] = await db()
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.id, id))
    .limit(1);

  return result;
}

export async function updateChatMessage(
  id: string,
  updateChatMessage: UpdateChatMessage
): Promise<ChatMessage> {
  const [result] = await db()
    .update(chatMessage)
    .set(updateChatMessage)
    .where(eq(chatMessage.id, id))
    .returning();

  return result;
}
