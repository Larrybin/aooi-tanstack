import { postRemoverHighResDownload } from '@/server/api/remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const postHighResDownload = withTanStackCloudflareBindings(
  postRemoverHighResDownload
);

export const Route = createFileRoute('/api/remover/download/high-res')({
  server: {
    handlers: {
      POST: ({ request }) => postHighResDownload(request),
    },
  },
});
