import { loadChatShellRouteData } from '@/server/chat/chat-route-data';
import { ChatIndexRouteView } from '@/surfaces/chat/chat-route.view';
import { createFileRoute, notFound } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/chat_')({
  loader: async ({ params }) => {
    const data = await loadChatShellRouteData({
      data: { locale: params.locale },
    });
    if (data.status === 'hidden') {
      throw notFound({ data: { locale: params.locale } });
    }
    return data;
  },
  component: ChatIndexRoute,
});

function ChatIndexRoute() {
  const data = Route.useLoaderData();
  return <ChatIndexRouteView initialUser={data.initialUser} />;
}
