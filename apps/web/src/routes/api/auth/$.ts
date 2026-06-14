import { handleAuthApiRequest } from '@/server/api/auth/auth-action';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const handleAuth = withTanStackCloudflareBindings(handleAuthApiRequest);

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
