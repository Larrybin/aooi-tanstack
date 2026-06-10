import { readAccountCreditsSummaryUseCase } from '@/domains/account/application/use-cases';

import { jsonOk } from '@/shared/lib/api/response';

type UserCreditsApiContext = {
  requireUser(): Promise<{ id: string }>;
};

type UserCreditsActionDeps = {
  createApiContext: (req: Request) => UserCreditsApiContext;
  getRemainingCreditsSummary: Parameters<
    typeof readAccountCreditsSummaryUseCase
  >[1]['getRemainingCreditsSummary'];
};

export function createUserCreditsPostAction(deps: UserCreditsActionDeps) {
  return async (req: Request) => {
    const user = await deps.createApiContext(req).requireUser();
    const credits = await readAccountCreditsSummaryUseCase(user.id, {
      getRemainingCreditsSummary: deps.getRemainingCreditsSummary,
    });

    return jsonOk(credits, { headers: { 'Cache-Control': 'no-store' } });
  };
}
