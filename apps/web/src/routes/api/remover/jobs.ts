import { postRemoverJobs } from '@/server/api/remover/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postJobs = withTanStackCloudflareBindings(postRemoverJobs);

export const Route = createFileRoute('/api/remover/jobs')({
  server: {
    handlers: {
      POST: ({ request }) => postJobs(request),
    },
  },
});
