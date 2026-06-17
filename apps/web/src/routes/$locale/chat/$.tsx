import {
  loadChatShellRouteData,
  loadChatThreadRouteData,
} from '@/server/chat/chat-route-data';
import {
  ChatHistoryRouteView,
  ChatThreadRouteView,
} from '@/surfaces/chat/chat-route.view';
import type { ChatShellRouteData, ChatThreadRouteData } from '@/server/chat/chat-route-resolver';
import { createFileRoute, redirect } from '@tanstack/react-router';
import type { UIMessage } from 'ai';

export const Route = createFileRoute('/$locale/chat/$')({
  loader: async ({ params }) => {
    const splat = (params as { _splat?: string })._splat ?? '';
    if (splat === 'history') {
      return {
        kind: 'history' as const,
        data: (await loadChatShellRouteData({ data: { locale: params.locale } }) as ChatShellRouteData),
      };
    }
    const data = (await loadChatThreadRouteData({
      data: { locale: params.locale, chatId: splat },
    })) as ChatThreadRouteData;
    if (data.status !== 'ok') throw redirect({ href: data.redirectTo });
    return { kind: 'thread' as const, data };
  },
  component: ChatSplatRoute,
});

function ChatSplatRoute() {
  const routeData = Route.useLoaderData();
  if (routeData.kind === 'history') {
    return <ChatHistoryRouteView initialUser={routeData.data.initialUser} />;
  }
  return (
    <ChatThreadRouteView
      initialUser={routeData.data.initialUser}
      initialChat={routeData.data.initialChat}
      initialMessages={JSON.parse(routeData.data.initialMessagesJson) as UIMessage[]}
    />
  );
}
