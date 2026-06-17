import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { buildRemoveMyImagesJobRequest } from './my-images-job-request';

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
  assert.match(source, /withApi\(\(request:\s*Request\)\s*=>\s*\{/);
  assert.match(
    source,
    /requireRemoverSite\(\);[\s\S]*return\s+removeMyImagesJob\(request\)/
  );
});

async function readRepoFile(repoPath: string) {
  return await readFile(path.resolve(rootDir, repoPath), 'utf8');
}
