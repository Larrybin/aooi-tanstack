import { getRemoverJob } from '@/server/api/remover/routes';
import { buildRemoveMyImagesJobRequest } from '@/server/remover/my-images-job-request';
import { removeMyImagesJob } from '@/server/remover/my-images-route-data';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const getJob = withTanStackCloudflareBindings(getRemoverJob);
const removeJob = withTanStackCloudflareBindings(removeMyImagesJob);

export const Route = createFileRoute('/api/remover/jobs/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => getJob(request, { params }),
      DELETE: ({ request, params }) =>
        removeJob(buildRemoveMyImagesJobRequest(request, params.id)),
    },
  },
});
