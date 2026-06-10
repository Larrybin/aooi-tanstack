import { createUserCreditsPostAction } from '@/app/api/user/get-user-credits/action';
import { getRemainingCreditsSummary } from '@/domains/account/infra/credit';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../../../server/api-context';

const postUserCredits = withApi(
  createUserCreditsPostAction({
    createApiContext: createTanStackApiContext,
    getRemainingCreditsSummary,
  })
);

export const Route = createFileRoute('/api/user/get-user-credits')({
  server: {
    handlers: {
      POST: ({ request }) => postUserCredits(request),
    },
  },
});
