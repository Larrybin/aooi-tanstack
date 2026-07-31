import { postBackgroundRemoverCleanup } from '@/server/api/background-remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const postCleanup = withTanStackCloudflareBindings(
  postBackgroundRemoverCleanup
);

export const Route = createFileRoute(
  '/(site_background-remover)/api/background-remover/cleanup'
)({
  server: {
    handlers: {
      POST: ({ request }) => postCleanup(request),
    },
  },
});
