'use client';

import { ChatBox } from './box';
import type { UIMessage } from 'ai';

import type { Chat } from '@/shared/types/chat';

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
