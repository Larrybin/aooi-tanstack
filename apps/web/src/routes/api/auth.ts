import { handleAuthApiRequest } from '@/server/api/auth/auth-action';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/auth')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthApiRequest(request),
      POST: ({ request }) => handleAuthApiRequest(request),
    },
  },
});
