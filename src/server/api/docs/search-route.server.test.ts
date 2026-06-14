import assert from 'node:assert/strict';
import test from 'node:test';

import { getDocsSearch } from './search-route';

test('docs/search returns a JSON array from serialized public content', async () => {
  const response = await getDocsSearch(
    new Request('http://localhost/api/docs/search?query=quick')
  );
  const body = (await response.json()) as unknown;

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /json/i);
  assert.equal(Array.isArray(body), true);
});

test('docs/search supports empty query', async () => {
  const response = await getDocsSearch(
    new Request('http://localhost/api/docs/search?query=')
  );
  const body = (await response.json()) as unknown[];

  assert.equal(response.status, 200);
  assert.deepEqual(body, []);
});
