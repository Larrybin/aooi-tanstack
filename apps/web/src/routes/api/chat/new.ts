import { createChatNewPostAction } from '@/server/api/chat/create-handlers';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';

import { createTanStackChatHandlerDeps } from '../../../server/chat-api-runtime';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postChat = withTanStackCloudflareBindings(
  withApi(createChatNewPostAction(createTanStackChatHandlerDeps()))
);

export const Route = createFileRoute('/api/chat/new')({
  server: {
    handlers: {
      POST: ({ request }) => postChat(request),
    },
  },
});
