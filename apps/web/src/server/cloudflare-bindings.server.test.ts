import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('runWithTanStackCloudflareBindings keeps the current scoped env when module env is unavailable', async () => {
  const source = await readFile(
    'apps/web/src/server/cloudflare-bindings.ts',
    'utf8'
  );

  assert.match(source, /if \(!bindings\) return await callback\(\);/);
  assert.match(source, /runWithCloudflareBindings\(bindings, callback\)/);
});
