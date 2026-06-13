import {
  readAuthUiRuntimeSettingsFresh,
  readPublicUiConfigFresh,
} from '@/domains/settings/application/settings-runtime.query';
import { site } from '@/site';
import type {
  AuthRouteData,
  AuthRouteMode,
  AuthRouteSearch,
  AuthShellData,
  AuthSignCopy,
  SerializablePublicUiConfig,
  SerializablePublicUiNavItem,
} from '@/surfaces/auth/auth-route/auth-route.types';

import { localeHreflangs, localeNames, locales } from '@/config/locale';
import { buildBrandPlaceholderValues } from '@/shared/brand/placeholders';
import { normalizeLocale } from '@/shared/i18n/locale';
import { normalizeCallbackUrl } from '@/shared/lib/callback-url';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { NavItem } from '@/shared/types/blocks/common';

import {
  loadAuthRouteMessages,
  type AuthRouteMessages,
} from './auth-route-messages';

const routePathByMode: Record<AuthRouteMode, string> = {
  'sign-in': '/sign-in',
  'sign-up': '/sign-up',
  'forgot-password': '/forgot-password',
  'reset-password': '/reset-password',
  'no-permission': '/no-permission',
};

export async function resolveAuthRouteData({
  locale: localeInput,
  mode,
  search,
}: {
  locale: unknown;
  mode: AuthRouteMode;
  search?: unknown;
}): Promise<AuthRouteData | null> {
  const locale = normalizeLocale(
    typeof localeInput === 'string' ? localeInput : null
  );
  if (!locale) {
    return null;
  }

  const messages = await loadAuthRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const [authSettings, publicUiConfig] = await Promise.all([
    readAuthUiRuntimeSettingsFresh(),
    readPublicUiConfigFresh(),
  ]);
  const brand = buildBrandPlaceholderValues();
  const canonicalPath = routePathByMode[mode];
  const sign = buildSignCopy(messages);
  const title = getTitleForMode(mode, sign);
  const description = getDescriptionForMode(mode, sign, messages);
  const parsedSearch = parseAuthSearch(search);

  return JSON.parse(
    JSON.stringify({
      locale,
      mode,
      canonicalPath,
      head: buildSeoHead({
        title: `${title} - ${getMetadataTitle(messages)}`,
        description,
        canonical: buildCanonicalUrl(canonicalPath, locale),
        alternates: buildAuthLanguageAlternates(canonicalPath),
        locale,
        siteName: site.brand.appName,
      }),
      shell: buildAuthShellData({
        locale,
        mode,
        sign,
        localeSwitcherAriaLabel:
          messages.locale_switcher?.aria_label || 'Change language',
        localeSwitcherEnabled: publicUiConfig.localeSwitcherEnabled,
        brand: {
          title: brand.appName,
          logo: brand.appLogo,
        },
      }),
      copy: {
        sign,
        accessDenied: 'Access denied',
      },
      authSettings,
      publicUiConfig: toSerializablePublicUiConfig(publicUiConfig),
      resetPasswordBaseUrl: buildCanonicalUrl('/reset-password', locale),
      search: parsedSearch,
    })
  ) as AuthRouteData;
}

function buildSignCopy(messages: AuthRouteMessages): AuthSignCopy {
  const sign = messages.sign ?? {};

  return {
    sign_in_title: readString(sign.sign_in_title, 'Sign In'),
    sign_in_description: readString(sign.sign_in_description, 'Sign in'),
    sign_up_title: readString(sign.sign_up_title, 'Sign Up'),
    sign_up_description: readString(
      sign.sign_up_description,
      'Create an account'
    ),
    return_to: readString(sign.return_to, "You'll be redirected to: {path}"),
    email_title: readString(sign.email_title, 'Email'),
    email_placeholder: readString(sign.email_placeholder, 'Email'),
    password_title: readString(sign.password_title, 'Password'),
    password_placeholder: readString(sign.password_placeholder, 'Password'),
    forgot_password: readString(sign.forgot_password, 'Forgot password?'),
    forgot_password_title: readString(
      sign.forgot_password_title,
      'Forgot password'
    ),
    forgot_password_description: readString(
      sign.forgot_password_description,
      'We will email you a reset link'
    ),
    forgot_password_submit: readString(
      sign.forgot_password_submit,
      'Send reset link'
    ),
    forgot_password_sent: readString(
      sign.forgot_password_sent,
      'If this email exists in our system, check your inbox for the reset link.'
    ),
    forgot_password_disabled: readString(
      sign.forgot_password_disabled,
      'Password reset is not available.'
    ),
    reset_password_title: readString(
      sign.reset_password_title,
      'Reset password'
    ),
    reset_password_description: readString(
      sign.reset_password_description,
      'Set a new password for your account'
    ),
    new_password_title: readString(sign.new_password_title, 'New password'),
    new_password_placeholder: readString(
      sign.new_password_placeholder,
      'Input your new password here'
    ),
    new_password_required: readString(
      sign.new_password_required,
      'New password is required'
    ),
    confirm_password_title: readString(
      sign.confirm_password_title,
      'Confirm password'
    ),
    confirm_password_placeholder: readString(
      sign.confirm_password_placeholder,
      'Re-enter your new password'
    ),
    confirm_password_required: readString(
      sign.confirm_password_required,
      'Please confirm your new password'
    ),
    password_mismatch: readString(
      sign.password_mismatch,
      'Passwords do not match'
    ),
    reset_password_submit: readString(
      sign.reset_password_submit,
      'Reset password'
    ),
    reset_password_success: readString(
      sign.reset_password_success,
      'Password reset successfully. Please sign in again.'
    ),
    reset_password_disabled: readString(
      sign.reset_password_disabled,
      'Password reset is not available.'
    ),
    invalid_reset_token: readString(
      sign.invalid_reset_token,
      'Invalid or expired reset link.'
    ),
    missing_reset_token: readString(
      sign.missing_reset_token,
      'Missing reset token. Please use the link from your email.'
    ),
    email_required: readString(sign.email_required, 'Email is required'),
    password_required: readString(
      sign.password_required,
      'Password is required'
    ),
    name_required: readString(sign.name_required, 'Name is required'),
    back_to_sign_in: readString(sign.back_to_sign_in, 'Back to Sign In'),
    no_account: readString(sign.no_account, "Don't have an account?"),
    google_sign_in_title: readString(
      sign.google_sign_in_title,
      'Sign in with Google'
    ),
    github_sign_in_title: readString(
      sign.github_sign_in_title,
      'Sign in with GitHub'
    ),
    sign_in_failed: readString(sign.sign_in_failed, 'Sign in failed'),
    sign_up_failed: readString(sign.sign_up_failed, 'Sign up failed'),
    request_password_reset_failed: readString(
      sign.request_password_reset_failed,
      'Request password reset failed'
    ),
    reset_password_failed: readString(
      sign.reset_password_failed,
      'Reset password failed'
    ),
    name_title: readString(sign.name_title, 'Name'),
    name_placeholder: readString(sign.name_placeholder, 'Input your name here'),
    auth_shell_eyebrow: readString(sign.auth_shell_eyebrow, 'Welcome back'),
    auth_shell_title: readString(sign.auth_shell_title, 'Sign in'),
    auth_shell_description: readString(
      sign.auth_shell_description,
      'Access your account.'
    ),
    auth_shell_points: readStringArray(sign.auth_shell_points),
  };
}

function buildAuthShellData({
  locale,
  mode,
  sign,
  localeSwitcherAriaLabel,
  localeSwitcherEnabled,
  brand,
}: {
  locale: string;
  mode: AuthRouteMode;
  sign: AuthSignCopy;
  localeSwitcherAriaLabel: string;
  localeSwitcherEnabled: boolean;
  brand: {
    title: string;
    logo?: string;
  };
}): AuthShellData {
  return {
    brand: {
      title: brand.title,
      url: localizePath('/', locale),
      logo: brand.logo ? { src: brand.logo, alt: brand.title } : undefined,
    },
    locale,
    localeSwitcherEnabled,
    localeSwitcherAriaLabel,
    localeOptions: locales.map((localeOption) => ({
      locale: localeOption,
      label: localeNames[localeOption] || localeOption,
      href: localizePath(routePathByMode[mode], localeOption),
      active: localeOption === locale,
    })),
    copy: {
      eyebrow: sign.auth_shell_eyebrow,
      title: sign.auth_shell_title,
      description: sign.auth_shell_description,
      points: sign.auth_shell_points,
    },
  };
}

function parseAuthSearch(search: unknown): AuthRouteSearch {
  const input =
    search && typeof search === 'object'
      ? (search as Record<string, unknown>)
      : {};
  const callbackUrl =
    typeof input.callbackUrl === 'string'
      ? normalizeCallbackUrl(input.callbackUrl)
      : undefined;

  return {
    ...(callbackUrl ? { callbackUrl } : {}),
    ...(typeof input.token === 'string' ? { token: input.token } : {}),
    ...(typeof input.error === 'string' ? { error: input.error } : {}),
  };
}

function buildAuthLanguageAlternates(path: string) {
  return Object.fromEntries(
    locales.map((locale) => [
      localeHreflangs[locale],
      buildCanonicalUrl(path, locale),
    ])
  );
}

function localizePath(path: string, locale: string) {
  if (locale === site.i18n.defaultLocale) {
    return path;
  }

  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

function getTitleForMode(mode: AuthRouteMode, sign: AuthSignCopy) {
  switch (mode) {
    case 'sign-in':
      return sign.sign_in_title;
    case 'sign-up':
      return sign.sign_up_title;
    case 'forgot-password':
      return sign.forgot_password_title;
    case 'reset-password':
      return sign.reset_password_title;
    case 'no-permission':
      return 'Access denied';
  }
}

function getDescriptionForMode(
  mode: AuthRouteMode,
  sign: AuthSignCopy,
  messages: AuthRouteMessages
) {
  switch (mode) {
    case 'sign-in':
      return sign.sign_in_description;
    case 'sign-up':
      return sign.sign_up_description;
    case 'forgot-password':
      return sign.forgot_password_description;
    case 'reset-password':
      return sign.reset_password_description;
    case 'no-permission':
      return messages.metadata?.description || `${site.brand.appName} access`;
  }
}

function getMetadataTitle(messages: AuthRouteMessages) {
  return messages.metadata?.title || site.brand.appName;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function toSerializablePublicUiConfig(
  config: Awaited<ReturnType<typeof readPublicUiConfigFresh>>
): SerializablePublicUiConfig {
  return {
    ...config,
    socialLinks: toSerializablePublicUiNavItems(config.socialLinks),
  };
}

function toSerializablePublicUiNavItems(
  items: readonly NavItem[]
): SerializablePublicUiNavItem[] {
  return items.map((item) => {
    const { icon, children, ...rest } = item;
    return {
      ...rest,
      ...(typeof icon === 'string' ? { icon } : {}),
      ...(children?.length
        ? { children: toSerializablePublicUiNavItems(children) }
        : {}),
    };
  });
}
