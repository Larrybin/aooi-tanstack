import {
  loadSettingsBillingCancelRouteData,
  loadSettingsBillingPortalRouteData,
  loadSettingsInvoiceRetrieveRouteData,
  submitSettingsBillingCancelRouteData,
} from '@/server/member/settings-billing-action-route-data';

import type {
  SettingsBillingActionRouteData,
  SettingsBillingCancelResult,
} from './settings-billing-action.types';

type RouteInput = {
  locale: string;
  search?: unknown;
};

export async function loadSettingsBillingCancelRouteSurfaceData(
  input: RouteInput
) {
  const data = await loadSettingsBillingCancelRouteData({
    data: input,
  });

  return data as SettingsBillingActionRouteData | null;
}

export async function loadSettingsBillingPortalRouteSurfaceData(
  input: RouteInput
) {
  const data = await loadSettingsBillingPortalRouteData({
    data: input,
  });

  return data as SettingsBillingActionRouteData | null;
}

export async function loadSettingsInvoiceRetrieveRouteSurfaceData(
  input: RouteInput
) {
  const data = await loadSettingsInvoiceRetrieveRouteData({
    data: input,
  });

  return data as SettingsBillingActionRouteData | null;
}

export async function submitSettingsBillingCancelRouteSurfaceData(input: {
  locale: string;
  subscriptionNo: string;
}) {
  const result = await submitSettingsBillingCancelRouteData({
    data: input,
  });

  return result as SettingsBillingCancelResult;
}
