import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { createApiContext } from '@/app/api/_lib/context';
import { createUserCreditsPostAction } from '@/server/api/user/get-user-credits-action';

import { withApi } from '@/shared/lib/api/route';

export const POST = withApi(
  createUserCreditsPostAction({
    createApiContext,
    getRemainingCreditsSummary: accountRuntimeDeps.getRemainingCreditsSummary,
  })
);
