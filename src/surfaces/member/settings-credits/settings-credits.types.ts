import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsCreditsRouteData = {
  locale: string;
  canonicalPath: '/settings/credits';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    errorMessage: string | null;
    remainingCredits: number;
    purchaseUrl: string;
    query: {
      page: number;
      pageSize: number;
      type: 'all' | 'grant' | 'consume';
    };
    pagination: {
      total: number;
      page: number;
      pageSize: number;
      previousHref: string | null;
      nextHref: string | null;
    };
    labels: {
      balanceTitle: string;
      purchaseButton: string;
      listTitle: string;
      transactionNo: string;
      description: string;
      type: string;
      scene: string;
      credits: string;
      expiresAt: string;
      createdAt: string;
      copyAction: string;
      copySuccess: string;
      previousPage: string;
      nextPage: string;
      empty: string;
    };
    tabs: Array<{
      title: string;
      type: 'all' | 'grant' | 'consume';
      href: string;
      active: boolean;
    }>;
    records: Array<{
      id: string;
      transactionNo: string;
      description: string;
      transactionType: string;
      transactionScene: string;
      credits: number;
      expiresAt: string | null;
      createdAt: string | null;
    }>;
  };
};
