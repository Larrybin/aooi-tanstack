import { getRemainingCreditsSummary } from '@/domains/account/infra/credit';
import { checkUserPermission } from '@/domains/access-control/application/checker';
import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import { readUserPermissionCodes } from '@/infra/adapters/access-control/repository';
import { createUserSelfDetailsPostAction } from '@/server/api/user/self-details-action';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';

import { createTanStackApiContext } from '../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postUserSelfDetails = withApi(
  createUserSelfDetailsPostAction({
    createApiContext: createTanStackApiContext,
    hasPermission: (userId, permissionCode) =>
      checkUserPermission(userId, permissionCode, { readUserPermissionCodes }),
    getRemainingCreditsSummary,
    getCurrentSubscription,
  })
);
const postUserSelfDetailsWithBindings =
  withTanStackCloudflareBindings(postUserSelfDetails);

export const Route = createFileRoute('/api/user/self-details')({
  server: {
    handlers: {
      POST: ({ request }) => postUserSelfDetailsWithBindings(request),
    },
  },
});
