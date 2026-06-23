import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { buildRemoveMyImagesJobRequest } from './my-images-job-request';
import { loadMyImagesRouteCopy } from './my-images-route-copy';

const rootDir = process.cwd();

test('buildRemoveMyImagesJobRequest preserves auth headers while changing method and body', async () => {
  const request = new Request('https://example.test/api/remover/jobs/job_1', {
    method: 'DELETE',
    headers: {
      cookie: 'sid=1',
      'x-forwarded-for': '203.0.113.1',
    },
  });

  const rewritten = buildRemoveMyImagesJobRequest(request, 'job_1');

  assert.equal(rewritten.method, 'POST');
  assert.equal(rewritten.headers.get('cookie'), 'sid=1');
  assert.equal(rewritten.headers.get('x-forwarded-for'), '203.0.113.1');
  assert.equal(rewritten.headers.get('content-type'), 'application/json');
  assert.deepEqual(await rewritten.json(), { jobId: 'job_1' });
});

test('TanStack remover job DELETE path applies the remover API guard', async () => {
  const source = await readRepoFile(
    'apps/web/src/routes/api/remover/jobs/$id.ts'
  );

  assert.match(source, /import\s+\{\s*requireRemoverSite\s*\}/);
  assert.match(source, /@\/server\/remover\/my-images-route-resolver/);
  assert.match(source, /withApi\(\(request:\s*Request\)\s*=>\s*\{/);
  assert.match(
    source,
    /requireRemoverSite\(\);[\s\S]*return\s+removeMyImagesJob\(request\)/
  );
});

test('loadMyImagesRouteCopy returns localized My Images labels', async () => {
  const copy = await loadMyImagesRouteCopy('zh');

  assert.equal(copy.title, '我的图片');
  assert.equal(copy.signInButton, '登录');
  assert.equal(copy.statuses.succeeded, '已完成');
});

test('TanStack My Images localized route rejects invalid locale data', async () => {
  const routeSource = await readRepoFile(
    'apps/web/src/routes/$locale/my-images.tsx'
  );
  const loaderSource = await readRepoFile(
    'src/server/remover/my-images-route-resolver.ts'
  );

  assert.match(loaderSource, /const locale = normalizeLocale\(data\.locale\);/);
  assert.match(loaderSource, /if \(!locale\) return null;/);
  assert.match(routeSource, /if \(!data\) \{\s*throw notFound/);
});

test('TanStack My Images route data and view restore the landing shell', async () => {
  const loaderSource = await readRepoFile(
    'src/server/remover/my-images-route-resolver.ts'
  );
  const viewSource = await readRepoFile(
    'src/surfaces/remover/my-images-route.view.tsx'
  );

  assert.match(loaderSource, /shell:\s*SlugShellData/);
  assert.match(loaderSource, /resolveLandingShellData\(locale\)/);
  assert.doesNotMatch(loaderSource, /settings-runtime\.query/);
  assert.match(viewSource, /LandingShellView/);
  assert.doesNotMatch(viewSource, /return\s*\(\s*<main/);
});

async function readRepoFile(repoPath: string) {
  return await readFile(path.resolve(rootDir, repoPath), 'utf8');
}
