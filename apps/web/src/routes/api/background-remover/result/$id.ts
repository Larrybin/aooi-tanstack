import { getBackgroundRemoverResult } from '@/server/api/background-remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const getResult = withTanStackCloudflareBindings(getBackgroundRemoverResult);

export const Route = createFileRoute('/api/background-remover/result/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => getResult(request, { params }),
    },
  },
});
