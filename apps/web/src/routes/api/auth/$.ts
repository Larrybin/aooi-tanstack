import { handleAuthApiRequest } from '@/server/api/auth/auth-action';
import { createFileRoute } from '@tanstack/react-router';

import {
  readTanStackAuthServerBindings,
  readTanStackAuthUiRuntimeSettings,
} from '../../../server/auth-runtime';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const handleAuth = withTanStackCloudflareBindings((request: Request) =>
  handleAuthApiRequest(request, {
    authConfigDeps: {
      readAuthUiRuntimeSettings: readTanStackAuthUiRuntimeSettings,
      getAuthServerBindings: readTanStackAuthServerBindings,
    },
  })
);

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
});
