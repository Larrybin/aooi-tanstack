import type {
  AuthUiRuntimeSettings,
  PublicUiConfig,
} from '@/domains/settings/application/settings-runtime.contracts';

import type { TanStackHead } from '@/shared/seo/canonical';
import type { NavItem } from '@/shared/types/blocks/common';

export type AuthRouteMode =
  | 'sign-in'
  | 'sign-up'
  | 'forgot-password'
  | 'reset-password'
  | 'no-permission';

export type AuthRouteSearch = {
  callbackUrl?: string;
  token?: string;
  error?: string;
};

export type AuthSignCopy = {
  sign_in_title: string;
  sign_in_description: string;
  sign_up_title: string;
  sign_up_description: string;
  return_to: string;
  email_title: string;
  email_placeholder: string;
  password_title: string;
  password_placeholder: string;
  forgot_password: string;
  forgot_password_title: string;
  forgot_password_description: string;
  forgot_password_submit: string;
  forgot_password_sent: string;
  forgot_password_disabled: string;
  reset_password_title: string;
  reset_password_description: string;
  new_password_title: string;
  new_password_placeholder: string;
  new_password_required: string;
  confirm_password_title: string;
  confirm_password_placeholder: string;
  confirm_password_required: string;
  password_mismatch: string;
  reset_password_submit: string;
  reset_password_success: string;
  reset_password_disabled: string;
  invalid_reset_token: string;
  missing_reset_token: string;
  email_required: string;
  password_required: string;
  name_required: string;
  back_to_sign_in: string;
  no_account: string;
  google_sign_in_title: string;
  github_sign_in_title: string;
  sign_in_failed: string;
  sign_up_failed: string;
  request_password_reset_failed: string;
  reset_password_failed: string;
  name_title: string;
  name_placeholder: string;
  auth_shell_eyebrow: string;
  auth_shell_title: string;
  auth_shell_description: string;
  auth_shell_points: string[];
};

export type AuthShellData = {
  brand: {
    title: string;
    url: string;
    logo?: {
      src: string;
      alt: string;
    };
  };
  locale: string;
  localeSwitcherEnabled: boolean;
  localeSwitcherAriaLabel: string;
  localeOptions: Array<{
    locale: string;
    label: string;
    href: string;
    active: boolean;
  }>;
  copy: {
    eyebrow: string;
    title: string;
    description: string;
    points: string[];
  };
};

export type SerializablePublicUiNavItem = Omit<NavItem, 'icon' | 'children'> & {
  icon?: string;
  children?: SerializablePublicUiNavItem[];
};

export type SerializablePublicUiConfig = Omit<PublicUiConfig, 'socialLinks'> & {
  socialLinks: SerializablePublicUiNavItem[];
};

export type AuthRouteData = {
  locale: string;
  mode: AuthRouteMode;
  canonicalPath: string;
  head: TanStackHead;
  shell: AuthShellData;
  copy: {
    sign: AuthSignCopy;
    accessDenied: string;
  };
  authSettings: AuthUiRuntimeSettings;
  publicUiConfig: SerializablePublicUiConfig;
  resetPasswordBaseUrl: string;
  search: AuthRouteSearch;
};
