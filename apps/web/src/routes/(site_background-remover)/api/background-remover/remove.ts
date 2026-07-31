import { postBackgroundRemoverRemove } from '@/server/api/background-remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const postRemove = withTanStackCloudflareBindings(postBackgroundRemoverRemove);

export const Route = createFileRoute(
  '/(site_background-remover)/api/background-remover/remove'
)({
  server: {
    handlers: {
      POST: ({ request }) => postRemove(request),
    },
  },
});
