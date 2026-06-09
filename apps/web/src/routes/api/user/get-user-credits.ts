import { readAccountCreditsSummaryUseCase } from '@/domains/account/application/use-cases';
import { getRemainingCreditsSummary } from '@/domains/account/infra/credit';
import { createFileRoute } from '@tanstack/react-router';

import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../../../server/api-context';

const postUserCredits = withApi(async (request: Request) => {
  const user = await createTanStackApiContext(request).requireUser();
  const credits = await readAccountCreditsSummaryUseCase(user.id, {
    getRemainingCreditsSummary,
  });

  return jsonOk(credits, { headers: { 'Cache-Control': 'no-store' } });
});

export const Route = createFileRoute('/api/user/get-user-credits')({
  server: {
    handlers: {
      POST: ({ request }) => postUserCredits(request),
    },
  },
});
