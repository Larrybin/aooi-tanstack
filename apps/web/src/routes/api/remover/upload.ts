import { postRemoverUpload } from '@/server/api/remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postUpload = withTanStackCloudflareBindings(postRemoverUpload);

export const Route = createFileRoute('/api/remover/upload')({
  server: {
    handlers: {
      POST: ({ request }) => postUpload(request),
    },
  },
});
