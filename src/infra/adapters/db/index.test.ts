import assert from 'node:assert/strict';
import test from 'node:test';

import { closeDb, db } from './index';

test('db reuses the same cached client for repeated serverless calls', async () => {
  const previousDatabaseProvider = process.env.DATABASE_PROVIDER;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousSingleton = process.env.DB_SINGLETON_ENABLED;

  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/cache-test';
  process.env.DB_SINGLETON_ENABLED = 'false';

  try {
    assert.strictEqual(db(), db());
  } finally {
    await closeDb();
    process.env.DATABASE_PROVIDER = previousDatabaseProvider;
    process.env.DATABASE_URL = previousDatabaseUrl;
    process.env.DB_SINGLETON_ENABLED = previousSingleton;
  }
});
