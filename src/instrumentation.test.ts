import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

test('instrumentation 只保留已启用 auth 站点的 secret 校验，不再执行数据库启动检查', async () => {
  const content = await readFile(
    path.resolve(currentDir, './instrumentation.ts'),
    'utf8'
  );

  assert.equal(content.includes("import { site } from '@/site';"), true);
  assert.equal(content.includes('site.capabilities.auth !== false'), true);
  assert.equal(content.includes('BETTER_AUTH_SECRET'), true);
  assert.equal(content.includes('DATABASE_URL'), false);
  assert.equal(content.includes('assertRoleDeletedAtColumnExists'), false);
  assert.equal(content.includes('db startup check failed'), false);

  assert.ok(
    content.indexOf('if (!isAuthEnabled())') <
      content.indexOf('const secret = getAuthSecret();')
  );
});
