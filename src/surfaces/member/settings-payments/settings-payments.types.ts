import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsPaymentsRouteData = {
  locale: string;
  canonicalPath: '/settings/payments';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    errorMessage: string | null;
    query: {
      page: number;
      pageSize: number;
      type: 'all' | 'one-time' | 'subscription' | 'renew';
      orderNo: string;
    };
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      previousHref: string | null;
      nextHref: string | null;
    };
    labels: {
      listTitle: string;
      listDescription: string;
      orderNo: string;
      productName: string;
      status: string;
      type: string;
      price: string;
      paidAmount: string;
      discountAmount: string;
      createdAt: string;
      invoice: string;
      copyAction: string;
      copySuccess: string;
      previousPage: string;
      nextPage: string;
      empty: string;
    };
    tabs: Array<{
      title: string;
      type: 'all' | 'one-time' | 'subscription' | 'renew';
      href: string;
      active: boolean;
    }>;
    records: Array<{
      id: string;
      orderNo: string;
      productName: string;
      status: string;
      type: string;
      price: string;
      paidAmount: string;
      discountAmount: string;
      createdAt: string;
      invoiceHref: string | null;
      invoiceExternal: boolean;
    }>;
  };
};
