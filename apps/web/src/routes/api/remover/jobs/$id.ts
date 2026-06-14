import { getRemoverJob } from '@/server/api/remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const getJob = withTanStackCloudflareBindings(getRemoverJob);

export const Route = createFileRoute('/api/remover/jobs/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => getJob(request, { params }),
    },
  },
});
