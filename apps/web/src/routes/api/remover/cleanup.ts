import { postRemoverCleanup } from '@/server/api/remover/cleanup-route';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postCleanup = withTanStackCloudflareBindings(postRemoverCleanup);

export const Route = createFileRoute('/api/remover/cleanup')({
  server: {
    handlers: {
      POST: ({ request }) => postCleanup(request),
    },
  },
});
