import { checkUserPermission } from '@/domains/access-control/application/checker';
import { getRemainingCreditsSummary } from '@/domains/account/infra/credit';
import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import { readUserPermissionCodes } from '@/infra/adapters/access-control/repository';
import { createUserCreditsPostAction } from '@/server/api/user/get-user-credits-action';
import { createUserSelfDetailsPostAction } from '@/server/api/user/self-details-action';

import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../api-context';
import { withTanStackCloudflareBindings } from '../cloudflare-bindings';

export const postUserSelfDetails = withTanStackCloudflareBindings(
  withApi(
    createUserSelfDetailsPostAction({
      createApiContext: createTanStackApiContext,
      hasPermission: (userId, permissionCode) =>
        checkUserPermission(userId, permissionCode, {
          readUserPermissionCodes,
        }),
      getRemainingCreditsSummary,
      getCurrentSubscription,
    })
  )
);

export const postUserCredits = withTanStackCloudflareBindings(
  withApi(
    createUserCreditsPostAction({
      createApiContext: createTanStackApiContext,
      getRemainingCreditsSummary,
    })
  )
);
