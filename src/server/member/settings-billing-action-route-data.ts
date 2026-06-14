import { createServerFn } from '@tanstack/react-start';

type SettingsBillingActionRouteInput = {
  locale: string;
  search?: unknown;
};

type SettingsBillingCancelInput = {
  locale: string;
  subscriptionNo: string;
};

function readRouteInput(data: unknown): SettingsBillingActionRouteInput {
  const input =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

  return {
    locale: typeof input.locale === 'string' ? input.locale : '',
    search: input.search,
  };
}

export const loadSettingsBillingCancelRouteData = createServerFn({
  method: 'GET',
})
  .validator(readRouteInput)
  .handler(async ({ data }) => {
    const { resolveSettingsBillingCancelRouteData } =
      await import('./settings-billing-action-route-resolver');

    return resolveSettingsBillingCancelRouteData(data);
  });

export const loadSettingsBillingPortalRouteData = createServerFn({
  method: 'GET',
})
  .validator(readRouteInput)
  .handler(async ({ data }) => {
    const { resolveSettingsBillingPortalRouteData } =
      await import('./settings-billing-action-route-resolver');

    return resolveSettingsBillingPortalRouteData(data);
  });

export const loadSettingsInvoiceRetrieveRouteData = createServerFn({
  method: 'GET',
})
  .validator(readRouteInput)
  .handler(async ({ data }) => {
    const { resolveSettingsInvoiceRetrieveRouteData } =
      await import('./settings-billing-action-route-resolver');

    return resolveSettingsInvoiceRetrieveRouteData(data);
  });

export const submitSettingsBillingCancelRouteData = createServerFn({
  method: 'POST',
})
  .validator((data: unknown): SettingsBillingCancelInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};

    return {
      locale: typeof input.locale === 'string' ? input.locale : '',
      subscriptionNo:
        typeof input.subscriptionNo === 'string' ? input.subscriptionNo : '',
    };
  })
  .handler(async ({ data }) => {
    const { resolveSettingsBillingCancelSubmit } =
      await import('./settings-billing-action-route-resolver');

    return resolveSettingsBillingCancelSubmit(data);
  });
