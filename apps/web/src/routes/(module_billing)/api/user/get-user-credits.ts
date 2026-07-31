import { createFileRoute } from '@tanstack/react-router';

import { postUserCredits } from '../../../../server/handlers/user';

export const Route = createFileRoute(
  '/(module_billing)/api/user/get-user-credits'
)({
  server: {
    handlers: {
      POST: ({ request }) => postUserCredits(request),
    },
  },
});
