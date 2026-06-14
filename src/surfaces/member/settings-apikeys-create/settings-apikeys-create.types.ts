import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsApiKeysCreateRouteData = {
  locale: string;
  canonicalPath: '/settings/apikeys/create';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    title: string;
    fields: {
      title: string;
    };
    submitButtonTitle: string;
    backHref: string;
    labels: {
      apiKeys: string;
    };
  };
};

export type SettingsApiKeyCreateResult = {
  status: 'success' | 'error';
  message: string;
  redirect_url?: string;
};
