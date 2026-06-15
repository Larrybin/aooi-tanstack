import { checkUserPermission } from '@/domains/access-control/application/checker';
import { readUserPermissionCodes } from '@/infra/adapters/access-control/repository';

import { ForbiddenError } from '@/shared/lib/api/errors';

type PermissionChecker = (userId: string, code: string) => Promise<boolean>;

type TanStackPermissionDeps = {
  checkUserPermission: PermissionChecker;
};

const defaultPermissionDeps: TanStackPermissionDeps = {
  checkUserPermission: (userId, code) =>
    checkUserPermission(userId, code, { readUserPermissionCodes }),
};

export function createTanStackPermissionHelper(
  deps: TanStackPermissionDeps = defaultPermissionDeps
) {
  return async function requirePermission(userId: string, code: string) {
    const allowed = await deps.checkUserPermission(userId, code);
    if (!allowed) {
      throw new ForbiddenError('no permission');
    }
  };
}

export const requireTanStackPermission = createTanStackPermissionHelper();
