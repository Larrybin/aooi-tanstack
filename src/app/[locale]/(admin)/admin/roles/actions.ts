'use server';

import { accessControlRuntimeDeps } from '@/app/access-control/runtime-deps';
import {
  deleteRoleUseCase,
  replaceRolePermissionsUseCase,
  restoreRoleUseCase,
  updateRoleMetadataUseCase,
} from '@/domains/access-control/application/checker';
import { AdminRoleUpdateFormSchema } from '@/surfaces/admin/schemas/role';
import {
  validateAndParseForm,
  validatePermission,
} from '@/app/_admin-support/action-utils';
import { z } from 'zod';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { jsonStringArraySchema } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';

/**
 * Update role title and description
 */
export async function updateRoleAction(id: string, formData: FormData) {
  return withAction(async () => {
    const { user, data } = await validateAndParseForm({
      formData,
      permission: PERMISSIONS.ROLES_WRITE,
      schema: AdminRoleUpdateFormSchema,
      errorMessage: 'title and description are required',
    });

    const result = await updateRoleMetadataUseCase(
      {
        roleId: id,
        title: data.title,
        description: data.description,
        actorUserId: user.id,
        source: 'admin.roles.updateRoleAction',
      },
      accessControlRuntimeDeps
    );
    if (!result) {
      throw new ActionError('update role failed');
    }

    return actionOk('role updated', '/admin/roles');
  });
}

/**
 * Update role permissions
 */
export async function updateRolePermissionsAction(
  id: string,
  formData: FormData
) {
  return withAction(async () => {
    const user = await validatePermission(PERMISSIONS.ROLES_WRITE);
    const parsed = z
      .object({ permissions: jsonStringArraySchema })
      .safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      throw new ActionError('permissions are required');
    }

    const result = await replaceRolePermissionsUseCase(
      {
        roleId: id,
        permissionIds: parsed.data.permissions,
        actorUserId: user.id,
        source: 'admin.roles.updateRolePermissionsAction',
      },
      accessControlRuntimeDeps
    );
    if (!result) {
      throw new ActionError('Role not found');
    }

    return actionOk('permissions updated', '/admin/roles');
  });
}

/**
 * Delete a role (soft delete)
 */
export async function deleteRoleAction(id: string) {
  return withAction(async () => {
    const user = await validatePermission(PERMISSIONS.ROLES_DELETE);

    const roleRow = await deleteRoleUseCase(
      {
        roleId: id,
        actorUserId: user.id,
        source: 'admin.roles.deleteRoleAction',
      },
      accessControlRuntimeDeps
    );
    if (!roleRow) {
      throw new ActionError('Role not found');
    }

    return actionOk('role deleted', '/admin/roles');
  });
}

/**
 * Restore a deleted role
 */
export async function restoreRoleAction(id: string) {
  return withAction(async () => {
    const user = await validatePermission(PERMISSIONS.ROLES_WRITE);

    const result = await restoreRoleUseCase(
      {
        roleId: id,
        actorUserId: user.id,
        source: 'admin.roles.restoreRoleAction',
      },
      accessControlRuntimeDeps
    );
    if (result.status === 'not_found') {
      throw new ActionError('Role not found');
    }
    if (result.status === 'not_deleted') {
      throw new ActionError('Role is not deleted');
    }
    if (result.status === 'name_conflict') {
      throw new ActionError(
        'restore role failed: another active role with the same name may already exist'
      );
    }

    return actionOk('role restored', '/admin/roles?includeDeleted=1');
  });
}
