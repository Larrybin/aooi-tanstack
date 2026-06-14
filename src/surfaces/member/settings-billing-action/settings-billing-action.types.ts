import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsBillingActionRouteData = {
  locale: string;
  canonicalPath:
    | '/settings/billing/cancel'
    | '/settings/billing/retrieve'
    | '/settings/invoices/retrieve';
  redirectHref: string | null;
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    kind: 'cancel' | 'message';
    title: string;
    description: string;
    message: string | null;
    backHref: string;
    query: {
      subscriptionNo: string;
      orderNo: string;
    };
    labels: {
      subscriptionNo: string;
      subscriptionAmount: string;
      intervalCycle: string;
      subscriptionCreatedAt: string;
      currentPeriod: string;
      submit: string;
      back: string;
      success: string;
    };
    subscription: {
      subscriptionNo: string;
      amount: string;
      intervalCycle: string;
      createdAt: string;
      currentPeriod: string;
    } | null;
  };
};

export type SettingsBillingCancelResult = {
  status: 'success' | 'error';
  message: string;
  redirectTo: string | null;
};
