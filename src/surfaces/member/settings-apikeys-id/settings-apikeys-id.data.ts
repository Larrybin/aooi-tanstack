import {
  loadSettingsApiKeysIdRouteData,
  submitSettingsApiKeyDeleteRouteData,
  submitSettingsApiKeyUpdateRouteData,
} from '@/server/member/settings-apikeys-id-route-data';

import type {
  SettingsApiKeyIdMutationResult,
  SettingsApiKeysIdRouteData,
} from './settings-apikeys-id.types';

export async function loadSettingsApiKeysIdRouteSurfaceData(input: {
  locale: string;
  id: string;
  mode: 'edit' | 'delete';
}) {
  const data = await loadSettingsApiKeysIdRouteData({
    data: input,
  });

  return data as SettingsApiKeysIdRouteData | null;
}

export async function submitSettingsApiKeyUpdateRouteSurfaceData(input: {
  locale: string;
  id: string;
  title: string;
}) {
  const result = await submitSettingsApiKeyUpdateRouteData({
    data: input,
  });

  return result as SettingsApiKeyIdMutationResult;
}

export async function submitSettingsApiKeyDeleteRouteSurfaceData(input: {
  locale: string;
  id: string;
  title: string;
}) {
  const result = await submitSettingsApiKeyDeleteRouteData({
    data: input,
  });

  return result as SettingsApiKeyIdMutationResult;
}
