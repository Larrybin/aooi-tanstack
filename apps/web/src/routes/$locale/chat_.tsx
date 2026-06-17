import { loadChatShellRouteData } from '@/server/chat/chat-route-data';
import { ChatIndexRouteView } from '@/surfaces/chat/chat-route.view';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/$locale/chat_')({
  loader: async ({ params }) =>
    loadChatShellRouteData({ data: { locale: params.locale } }),
  component: ChatIndexRoute,
});

function ChatIndexRoute() {
  const data = Route.useLoaderData();
  return <ChatIndexRouteView initialUser={data.initialUser} />;
}
