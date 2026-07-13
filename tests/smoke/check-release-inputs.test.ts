import assert from 'node:assert/strict';
import test from 'node:test';

import { assertReleaseInputs } from '../../scripts/check-release-inputs.mjs';

test('release input guard accepts schema change with committed migration', () => {
  assert.doesNotThrow(() =>
    assertReleaseInputs([
      'src/config/db/schema.ts',
      'src/config/db/migrations/0001_init.sql',
    ])
  );
});

test('release input guard accepts non-schema changes', () => {
  assert.doesNotThrow(() =>
    assertReleaseInputs([
      'apps/web/src/routes/index.tsx',
      'cloudflare/workers/router.ts',
    ])
  );
});

test('release input guard rejects schema change without committed migration', () => {
  assert.throws(
    () => assertReleaseInputs(['src/config/db/schema.ts']),
    /changed without any committed migration/i
  );
});
