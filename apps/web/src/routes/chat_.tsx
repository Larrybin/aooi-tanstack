import { loadChatShellRouteData } from '@/server/chat/chat-route-data';
import { ChatIndexRouteView } from '@/surfaces/chat/chat-route.view';
import { createFileRoute } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/chat_')({
  loader: async () => loadChatShellRouteData({ data: { locale: defaultLocale } }),
  component: ChatIndexRoute,
});

function ChatIndexRoute() {
  const data = Route.useLoaderData();
  return <ChatIndexRouteView initialUser={data.initialUser} />;
}
