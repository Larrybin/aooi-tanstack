import { createFileRoute } from '@tanstack/react-router';

import { postUserCredits } from '../../../server/handlers/user';

export const Route = createFileRoute('/api/user/get-user-credits')({
  server: {
    handlers: {
      POST: ({ request }) => postUserCredits(request),
    },
  },
});
