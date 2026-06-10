import { accountRuntimeDeps } from '@/app/account/runtime-deps';
import { createApiContext } from '@/app/api/_lib/context';

import { withApi } from '@/shared/lib/api/route';

import { createUserCreditsPostAction } from './action';

export const POST = withApi(
  createUserCreditsPostAction({
    createApiContext,
    getRemainingCreditsSummary: accountRuntimeDeps.getRemainingCreditsSummary,
  })
);
