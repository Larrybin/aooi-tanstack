import {
  getRemoverLowResDownload,
  postRemoverLowResDownload,
} from '@/server/api/remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const getLowResDownload = withTanStackCloudflareBindings(
  getRemoverLowResDownload
);
const postLowResDownload = withTanStackCloudflareBindings(
  postRemoverLowResDownload
);

export const Route = createFileRoute('/api/remover/download/low-res')({
  server: {
    handlers: {
      GET: ({ request }) => getLowResDownload(request),
      POST: ({ request }) => postLowResDownload(request),
    },
  },
});
