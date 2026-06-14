import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsApiKeysIdRouteData = {
  locale: string;
  canonicalPath:
    | `/settings/apikeys/${string}/edit`
    | `/settings/apikeys/${string}/delete`;
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    mode: 'edit' | 'delete';
    message: string | null;
    title: string;
    noAuthMessage: string;
    noPermissionMessage: string;
    backHref: string;
    labels: {
      apiKeys: string;
      title: string;
      key: string;
      submit: string;
    };
    apikey: {
      id: string;
      title: string;
      key?: string;
    } | null;
  };
};

export type SettingsApiKeyIdMutationResult = {
  status: 'success' | 'error';
  message: string;
  redirect_url?: string;
};
