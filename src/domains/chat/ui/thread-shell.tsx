'use client';

import type { UIMessage } from 'ai';

import type { Chat } from '@/shared/types/chat';

import { ChatBox } from './box';

export function ChatThreadShell({
  initialChat,
  initialMessages,
}: {
  initialChat?: Chat;
  initialMessages?: UIMessage[];
}) {
  return (
    <ChatBox initialChat={initialChat} initialMessages={initialMessages} />
  );
}
