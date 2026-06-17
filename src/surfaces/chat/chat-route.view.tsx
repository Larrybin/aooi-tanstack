import { ChatGenerator } from '@/domains/chat/ui/generator';
import { ChatHistory } from '@/domains/chat/ui/history';
import { ChatRouteShell } from '@/domains/chat/ui/route-shell';
import { ChatThreadShell } from '@/domains/chat/ui/thread-shell';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';
import type { Chat } from '@/shared/types/chat';
import type { UIMessage } from 'ai';

export function ChatIndexRouteView({
  initialUser,
}: {
  initialUser: AuthSessionUserSnapshot | null;
}) {
  return (
    <ChatRouteShell initialUser={initialUser}>
      <ChatGenerator />
    </ChatRouteShell>
  );
}

export function ChatHistoryRouteView({
  initialUser,
}: {
  initialUser: AuthSessionUserSnapshot | null;
}) {
  return (
    <ChatRouteShell initialUser={initialUser}>
      <ChatHistory />
    </ChatRouteShell>
  );
}

export function ChatThreadRouteView({
  initialUser,
  initialChat,
  initialMessages,
}: {
  initialUser: AuthSessionUserSnapshot | null;
  initialChat: Chat;
  initialMessages: UIMessage[];
}) {
  return (
    <ChatRouteShell initialUser={initialUser}>
      <ChatThreadShell
        initialChat={initialChat}
        initialMessages={initialMessages}
      />
    </ChatRouteShell>
  );
}
