import { getRemainingCreditsSummary } from '@/domains/account/infra/credit';
import { createUserCreditsPostAction } from '@/server/api/user/get-user-credits-action';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postUserCredits = withApi(
  createUserCreditsPostAction({
    createApiContext: createTanStackApiContext,
    getRemainingCreditsSummary,
  })
);
const postUserCreditsWithBindings =
  withTanStackCloudflareBindings(postUserCredits);

export const Route = createFileRoute('/api/user/get-user-credits')({
  server: {
    handlers: {
      POST: ({ request }) => postUserCreditsWithBindings(request),
    },
  },
});
