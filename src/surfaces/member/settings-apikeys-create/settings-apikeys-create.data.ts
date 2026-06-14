import {
  loadSettingsApiKeysCreateRouteData,
  submitSettingsApiKeyCreateRouteData,
} from '@/server/member/settings-apikeys-create-route-data';

import type {
  SettingsApiKeyCreateResult,
  SettingsApiKeysCreateRouteData,
} from './settings-apikeys-create.types';

export async function loadSettingsApiKeysCreateRouteSurfaceData(input: {
  locale: string;
}) {
  const data = await loadSettingsApiKeysCreateRouteData({
    data: input,
  });

  return data as SettingsApiKeysCreateRouteData | null;
}

export async function submitSettingsApiKeyCreateRouteSurfaceData(input: {
  locale: string;
  title: string;
}) {
  const result = await submitSettingsApiKeyCreateRouteData({
    data: input,
  });

  return result as SettingsApiKeyCreateResult;
}
