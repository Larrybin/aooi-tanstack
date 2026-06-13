import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsSecurityRouteData = {
  locale: string;
  canonicalPath: '/settings/security';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    resetPassword: {
      title: string;
      description: string;
      tip: string;
      button: {
        title: string;
        href: string;
      };
    };
    deleteAccount: {
      title: string;
      description: string;
      tip: string;
    };
  };
};
