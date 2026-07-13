import { createFileRoute } from '@tanstack/react-router';

import { postUserSelfDetails } from '../../../server/handlers/user';

export const Route = createFileRoute('/api/user/self-details')({
  server: {
    handlers: {
      POST: ({ request }) => postUserSelfDetails(request),
    },
  },
});
