import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsApiKeysRouteData = {
  locale: string;
  canonicalPath: '/settings/apikeys';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    errorMessage: string | null;
    createHref: string;
    query: {
      page: number;
      pageSize: number;
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
      title: string;
      key: string;
      createdAt: string;
      action: string;
      create: string;
      edit: string;
      delete: string;
      copyAction: string;
      copySuccess: string;
      previousPage: string;
      nextPage: string;
      empty: string;
    };
    records: Array<{
      id: string;
      title: string;
      key: string;
      createdAt: string;
      editHref: string;
      deleteHref: string;
    }>;
  };
};
