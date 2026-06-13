import {
  loadSettingsProfileRouteData,
  submitSettingsProfileRouteData,
} from '@/server/member/settings-profile-route-data';

import type {
  SettingsProfileRouteData,
  SettingsProfileUpdateResult,
} from './settings-profile.types';

export async function loadSettingsProfileRouteSurfaceData(input: {
  locale: string;
}) {
  const data = await loadSettingsProfileRouteData({
    data: input,
  });

  return data as SettingsProfileRouteData | null;
}

export async function submitSettingsProfileRouteSurfaceData(input: {
  locale: string;
  name: string;
  image: string;
}) {
  const result = await submitSettingsProfileRouteData({
    data: input,
  });

  return result as SettingsProfileUpdateResult;
}
