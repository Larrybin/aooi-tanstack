import { loadChatShellRouteData } from '@/server/chat/chat-route-data';
import { ChatIndexRouteView } from '@/surfaces/chat/chat-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/chat_')({
  loader: async () => {
    const data = await loadChatShellRouteData({
      data: { locale: defaultLocale },
    });
    if (data.status === 'hidden') throw notFound();
    return data;
  },
  component: ChatIndexRoute,
});

function ChatIndexRoute() {
  const data = Route.useLoaderData();
  return <ChatIndexRouteView initialUser={data.initialUser} />;
}
