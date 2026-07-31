import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('__root loads runtime injections once and shares loaderData', async () => {
  const content = await readFile(
    new URL('../../apps/web/src/routes/__root.tsx', import.meta.url),
    'utf8'
  );

  assert.match(content, /loader:\s*async/);
  assert.equal(
    content.match(/loadRootRuntimeInjections\(\{\s*data:\s*\{\}\s*\}\)/g)
      ?.length,
    1
  );
  assert.match(content, /head:\s*\(\{\s*loaderData\s*\}\)/);
  assert.match(content, /scripts:\s*\(\{\s*loaderData\s*\}\)/);
});
