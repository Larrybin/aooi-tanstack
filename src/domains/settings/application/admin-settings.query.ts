import { normalizeSettingOverrides } from '../settings-normalizers';
import { mergeRegisteredSettingValues } from '../settings-submit-merge';
import { readSettingsSafe, saveSettings } from './settings-store';

export async function readAdminSettingsSafe() {
  return readSettingsSafe();
}

export async function saveAdminSettingsValues(
  values: Record<string, string>,
  deps = {
    readSettings: readSettingsSafe,
    saveSettings,
  }
) {
  const settingsResult = await deps.readSettings();
  if (settingsResult.error) {
    return {
      ok: false as const,
      message:
        'Settings could not be saved because configuration values failed to load. Please try again later.',
    };
  }

  const normalizedOverrides = normalizeSettingOverrides(values);
  if (!normalizedOverrides.ok) {
    return { ok: false as const, message: normalizedOverrides.error };
  }

  const nextConfigs = mergeRegisteredSettingValues({
    initialConfigs: settingsResult.configs,
    values,
    normalizedOverrides: normalizedOverrides.value,
  });

  await deps.saveSettings(nextConfigs);
  return { ok: true as const };
}
