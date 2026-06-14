import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsBillingRouteData = {
  locale: string;
  canonicalPath: '/settings/billing';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    errorMessage: string | null;
    purchaseUrl: string;
    query: {
      page: number;
      pageSize: number;
      status:
        | 'all'
        | 'active'
        | 'trialing'
        | 'paused'
        | 'expired'
        | 'pending_cancel'
        | 'canceled';
      orderNo: string;
    };
    paymentCallback: {
      orderNo: string;
      cleanUrl: string;
    } | null;
    currentSubscription: {
      subscriptionNo: string;
      planName: string;
      status: string;
      tip: string | null;
    } | null;
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      previousHref: string | null;
      nextHref: string | null;
    };
    labels: {
      currentPlanTitle: string;
      noSubscription: string;
      subscribeButton: string;
      adjustButton: string;
      listTitle: string;
      subscriptionNo: string;
      interval: string;
      status: string;
      amount: string;
      createdAt: string;
      currentPeriod: string;
      endTime: string;
      copyAction: string;
      copySuccess: string;
      previousPage: string;
      nextPage: string;
      empty: string;
      callbackTitle: string;
      callbackOrderNo: string;
      callbackClear: string;
    };
    tabs: Array<{
      title: string;
      status:
        | 'all'
        | 'active'
        | 'trialing'
        | 'paused'
        | 'expired'
        | 'pending_cancel'
        | 'canceled';
      href: string;
      active: boolean;
    }>;
    records: Array<{
      id: string;
      subscriptionNo: string;
      interval: string;
      status: string;
      amount: string;
      createdAt: string;
      currentPeriod: string;
      endTime: string;
    }>;
  };
};
