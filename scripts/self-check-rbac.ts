/**
 * RBAC Strong-Consistency Self Check (no test framework)
 *
 * What it verifies:
 * - RBAC reads are strongly consistent across requests: after role/permission changes,
 *   the next query reflects the latest database state (no stale cache in shared service).
 * - Wildcard permission matching works as expected (e.g. "foo.bar.*").
 *
 * Usage:
 *   pnpm tsx scripts/self-check-rbac.ts --confirm=YES
 *
 * Notes:
 * - This script WILL write to your database. Run only against a local/dev database.
 * - It does NOT hard-delete any rows. It expires the user_role and marks the role as deleted,
 *   so the created records become inert. Permission rows remain (unique code with random suffix).
 */

import '@/config/load-dotenv';

import { AccessControlRoleStatus } from '@/infra/adapters/access-control/repository';
import { db } from '@/infra/adapters/db';
import { and, eq } from 'drizzle-orm';

import {
  permission,
  role,
  rolePermission,
  user,
  userRole,
} from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { getUuid } from '@/shared/lib/hash';

const LOG_PREFIX = '[rbac-selfcheck]';

function getArgValue(argName: string): string | undefined {
  const prefix = `--${argName}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : undefined;
}

function getSafeDatabaseTarget(databaseUrl: string): string {
  if (!databaseUrl) {
    return '(DATABASE_URL is empty)';
  }

  try {
    const url = new URL(databaseUrl);
    const port = url.port ? `:${url.port}` : '';
    const pathname = url.pathname || '';
    return `${url.protocol}//${url.hostname}${port}${pathname}`;
  } catch {
    return '(DATABASE_URL is not a valid URL)';
  }
}

function requireConfirm() {
  const confirm = getArgValue('confirm');
  if (confirm !== 'YES') {
    throw new Error(
      'Refusing to run: missing confirmation. Re-run with `--confirm=YES` (dev DB only).'
    );
  }
}

function createSuffix(): string {
  const random = Math.random().toString(16).slice(2);
  return `${Date.now()}_${random}`;
}

async function main() {
  requireConfirm();
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run in production (NODE_ENV=production).');
  }

  const now = new Date();
  const suffix = createSuffix();

  console.log(
    `${LOG_PREFIX} target db: ${getSafeDatabaseTarget(serverEnv.databaseUrl)}`
  );

  const testUserId = getUuid();
  const testRoleId = getUuid();
  const testPermissionExactId = getUuid();
  const testPermissionWildcardId = getUuid();

  const permissionPrefix = `rbac.selfcheck.${suffix}`;
  const exactPermissionCode = `${permissionPrefix}.exact`;
  const wildcardPermissionCode = `${permissionPrefix}.*`;
  const wildcardTargetCode = `${permissionPrefix}.anything`;

  const testEmail = `rbac-selfcheck+${suffix}@example.com`;

  console.log(`${LOG_PREFIX} creating test user/role/permissions…`);

  await db().insert(user).values({
    id: testUserId,
    name: 'RBAC Self Check',
    email: testEmail,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });

  await db()
    .insert(role)
    .values({
      id: testRoleId,
      name: `rbac_selfcheck_${suffix}`,
      title: 'RBAC Self Check',
      description: 'Created by scripts/self-check-rbac.ts',
      status: AccessControlRoleStatus.ACTIVE,
      createdAt: now,
      updatedAt: now,
      sort: 0,
    });

  await db().insert(permission).values({
    id: testPermissionExactId,
    code: exactPermissionCode,
    resource: 'rbac_selfcheck',
    action: 'read',
    title: 'RBAC Self Check (exact)',
    description: 'Exact permission for RBAC self-check',
    createdAt: now,
    updatedAt: now,
  });

  await db().insert(permission).values({
    id: testPermissionWildcardId,
    code: wildcardPermissionCode,
    resource: 'rbac_selfcheck',
    action: 'read',
    title: 'RBAC Self Check (wildcard)',
    description: 'Wildcard permission for RBAC self-check',
    createdAt: now,
    updatedAt: now,
  });

  await db()
    .insert(rolePermission)
    .values([
      {
        id: getUuid(),
        roleId: testRoleId,
        permissionId: testPermissionExactId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      {
        id: getUuid(),
        roleId: testRoleId,
        permissionId: testPermissionWildcardId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

  await db().insert(userRole).values({
    id: getUuid(),
    userId: testUserId,
    roleId: testRoleId,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  });

  console.log(`${LOG_PREFIX} verifying permissions (should be TRUE)…`);
  const exactBefore = await accessControlRuntimeDeps.checkUserPermission(
    testUserId,
    exactPermissionCode
  );
  const wildcardBefore = await accessControlRuntimeDeps.checkUserPermission(
    testUserId,
    wildcardTargetCode
  );

  if (!exactBefore) {
    throw new Error(
      `Expected exact permission to be true: ${exactPermissionCode}`
    );
  }
  if (!wildcardBefore) {
    throw new Error(
      `Expected wildcard permission to be true: ${wildcardTargetCode}`
    );
  }

  console.log(
    `${LOG_PREFIX} revoking by expiring user_role (strong consistency)…`
  );
  await db()
    .update(userRole)
    .set({ expiresAt: new Date(0), updatedAt: new Date() })
    .where(andEqUserRole(testUserId, testRoleId));

  const exactAfter = await accessControlRuntimeDeps.checkUserPermission(
    testUserId,
    exactPermissionCode
  );
  const wildcardAfter = await accessControlRuntimeDeps.checkUserPermission(
    testUserId,
    wildcardTargetCode
  );

  if (exactAfter || wildcardAfter) {
    throw new Error(
      `Expected permissions to be false after revoke, got exact=${exactAfter} wildcard=${wildcardAfter}`
    );
  }

  console.log(`${LOG_PREFIX} soft-deleting role to make records inert…`);
  await db()
    .update(role)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(role.id, testRoleId));

  console.log(`${LOG_PREFIX} OK`);
  console.log(`${LOG_PREFIX} created (inert) artifacts:`);
  console.log(`${LOG_PREFIX} user.email=${testEmail}`);
  console.log(`${LOG_PREFIX} role.name=rbac_selfcheck_${suffix}`);
  console.log(`${LOG_PREFIX} permission.code=${exactPermissionCode}`);
  console.log(`${LOG_PREFIX} permission.code=${wildcardPermissionCode}`);
}

function andEqUserRole(userId: string, roleId: string) {
  return and(eq(userRole.userId, userId), eq(userRole.roleId, roleId));
}

main().catch((err: unknown) => {
  console.error(`${LOG_PREFIX} FAILED:`, err);
  process.exitCode = 1;
});
