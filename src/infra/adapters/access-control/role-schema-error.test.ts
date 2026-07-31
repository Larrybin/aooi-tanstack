import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRoleDeletedAtMissingHint,
  isMissingRoleDeletedAtColumnError,
} from './role-schema-error';

test('isMissingRoleDeletedAtColumnError: pg code=42703 且包含 role.deleted_at does not exist 时返回 true', () => {
  assert.equal(
    isMissingRoleDeletedAtColumnError({
      code: '42703',
      message: 'column "role"."deleted_at" does not exist',
    }),
    true
  );
});

test('isMissingRoleDeletedAtColumnError: 非匹配错误返回 false', () => {
  assert.equal(isMissingRoleDeletedAtColumnError(null), false);
  assert.equal(isMissingRoleDeletedAtColumnError({}), false);
  assert.equal(
    isMissingRoleDeletedAtColumnError({
      code: '42P01',
      message: 'missing table',
    }),
    false
  );
});

test('buildRoleDeletedAtMissingHint points operators to migrations', () => {
  const hint = buildRoleDeletedAtMissingHint();

  assert.match(hint, /missing column public\.role\.deleted_at/i);
  assert.match(hint, /pnpm db:migrate/i);
});
