import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsSecurityRouteData } from '@/surfaces/member/settings-security/settings-security.types';
import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsSecurityRouteMessages,
  type SettingsSecurityRouteMessages,
} from './settings-security-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsSecurityRouteInput = {
  locale: unknown;
};

type SettingsSecurityRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
};

const canonicalPath = '/settings/security' as const;

export async function resolveSettingsSecurityRouteData(
  input: SettingsSecurityRouteInput,
  deps: SettingsSecurityRouteResolverDeps = {}
): Promise<SettingsSecurityRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  const messages = await loadSettingsSecurityRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();

  return JSON.parse(
    JSON.stringify({
      locale,
      canonicalPath,
      head: buildSettingsSecurityHead(messages, locale),
      shell: buildSettingsShellData(messages, locale),
      viewer: {
        signedIn: Boolean(signedInUser),
      },
      page: buildSettingsSecurityPageData(messages, locale),
    })
  ) as SettingsSecurityRouteData;
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

function buildSettingsSecurityHead(
  messages: SettingsSecurityRouteMessages,
  locale: string
) {
  const security = getObject(messages.security);
  const resetPassword = getObject(security.reset_password);
  const crumbs = getObject(resetPassword.crumbs);
  const title = readString(crumbs.security, 'Security');
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const description = readString(
    resetPassword.description,
    'Security settings'
  );
  const head = buildSeoHead({
    title: `${title} - ${settingsTitle} - ${site.brand.appName}`,
    description,
    canonical: buildCanonicalUrl(canonicalPath, locale),
    locale,
    siteName: site.brand.appName,
  });

  return {
    ...head,
    meta: [
      ...(head.meta ?? []),
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  };
}

function buildSettingsShellData(
  messages: SettingsSecurityRouteMessages,
  locale: string
): SettingsShellData {
  const sidebar = getObject(messages.sidebar);

  return {
    title: readString(sidebar.title, 'Settings'),
    nav: {
      items: buildSettingsShellNavItems({
        activePath: canonicalPath,
        locale,
        sidebar,
      }),
    },
    topNav: {
      items: [
        {
          title: readString(sidebar.title, 'Settings'),
          url: localePath(canonicalPath, locale),
          active: true,
        },
      ],
    },
  };
}

function buildSettingsSecurityPageData(
  messages: SettingsSecurityRouteMessages,
  locale: string
): SettingsSecurityRouteData['page'] {
  const security = getObject(messages.security);
  const resetPassword = getObject(security.reset_password);
  const deleteAccount = getObject(security.delete_account);

  return {
    noAuthMessage: readString(security.no_auth, 'no auth'),
    resetPassword: {
      title: readString(resetPassword.title, 'Reset Password'),
      description: readString(resetPassword.description, 'Reset your password'),
      tip: readString(
        resetPassword.tip,
        'We will send you an email to reset your password.'
      ),
      button: {
        title: readString(
          getObject(resetPassword.buttons).submit,
          'Send reset link'
        ),
        href: localePath('/forgot-password', locale),
      },
    },
    deleteAccount: {
      title: readString(deleteAccount.title, 'Delete Account'),
      description: readString(deleteAccount.description, 'Delete your account'),
      tip: readString(
        deleteAccount.tip,
        'Are you sure you want to delete your account? This action cannot be undone.'
      ),
    },
  };
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
