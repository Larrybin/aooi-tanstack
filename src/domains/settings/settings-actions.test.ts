import assert from 'node:assert/strict';
import test from 'node:test';

import { saveAdminSettingsValues } from './application/admin-settings.query';
import { mergeRegisteredSettingValues } from './settings-submit-merge';

test('mergeRegisteredSettingValues: 忽略未注册 key 并应用归一化覆盖', () => {
  const nextConfigs = mergeRegisteredSettingValues({
    initialConfigs: {
      general_social_links: '[]',
    },
    values: {
      general_social_links: '  ',
      injected_key: 'should-be-ignored',
    },
    normalizedOverrides: {
      general_social_links: '',
    },
  });

  assert.deepEqual(nextConfigs, {
    general_social_links: '',
  });
});

test('saveAdminSettingsValues: normalizes and saves registered settings', async () => {
  let savedConfigs: Record<string, string> | undefined;

  const result = await saveAdminSettingsValues(
    { google_auth_enabled: 'true' },
    {
      readSettings: async () => ({
        configs: { google_auth_enabled: 'false', unrelated: 'kept' },
      }),
      saveSettings: async (configs) => {
        savedConfigs = configs;
        return [];
      },
    }
  );

  assert.deepEqual(result, { ok: true });
  assert.equal(savedConfigs?.google_auth_enabled, 'true');
  assert.equal(savedConfigs?.unrelated, 'kept');
});
