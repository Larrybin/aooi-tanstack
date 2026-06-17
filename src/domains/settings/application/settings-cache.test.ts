import assert from 'node:assert/strict';
import test from 'node:test';

import { cacheSettingsReader } from './settings-cache';
import {
  getRuntimeSettingsCacheVersion,
  invalidateRuntimeSettingsCacheVersion,
} from './settings-cache-version';
import { invalidateSettingsCache } from './settings-store';

test('cacheSettingsReader observes runtime settings cache invalidation', async () => {
  let calls = 0;
  const readCached = cacheSettingsReader(
    async () => {
      calls += 1;
      return { value: calls };
    },
    { revalidateSeconds: 3600 }
  );

  assert.deepEqual(await readCached(), { value: 1 });
  assert.deepEqual(await readCached(), { value: 1 });

  invalidateRuntimeSettingsCacheVersion();

  assert.deepEqual(await readCached(), { value: 2 });
  assert.equal(calls, 2);
});

test('invalidateSettingsCache bumps the shared runtime cache version', () => {
  const before = getRuntimeSettingsCacheVersion();

  invalidateSettingsCache();

  assert.equal(getRuntimeSettingsCacheVersion(), before + 1);
});
