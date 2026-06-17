import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRemoveMyImagesJobRequest } from './my-images-job-request';

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
