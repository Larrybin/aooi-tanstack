import { getBackgroundRemoverDownload } from '@/server/api/background-remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const getDownload = withTanStackCloudflareBindings(
  getBackgroundRemoverDownload
);

export const Route = createFileRoute('/api/background-remover/download/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => getDownload(request, { params }),
    },
  },
});
