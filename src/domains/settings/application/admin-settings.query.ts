import { readSettingsSafe } from './settings-store';

export async function readAdminSettingsSafe() {
  return readSettingsSafe();
}
