import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import type { TanStackHead } from '@/shared/seo/canonical';

export type SettingsProfileRouteData = {
  locale: string;
  canonicalPath: '/settings/profile';
  head: TanStackHead;
  shell: SettingsShellData;
  viewer: {
    signedIn: boolean;
  };
  page: {
    noAuthMessage: string;
    title: string;
    description: string;
    fields: {
      email: string;
      name: string;
      avatar: string;
    };
    profile: {
      email: string;
      name: string;
      image: string | null;
    } | null;
    submitButtonTitle: string;
  };
};

export type SettingsProfileUpdateResult = {
  status: 'success' | 'error';
  message: string;
  redirect_url?: string;
  profile?: {
    email: string;
    name: string;
    image: string | null;
  };
};
