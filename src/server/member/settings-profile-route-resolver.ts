import { updateProfileUseCase } from '@/domains/account/application/use-cases';
import { updateUser as updateAccountUser } from '@/domains/account/infra/user';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type {
  SettingsProfileRouteData,
  SettingsProfileUpdateResult,
} from '@/surfaces/member/settings-profile/settings-profile.types';
import type {
  SettingsShellData,
  SettingsShellNavItem,
} from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { normalizeProfileImageValue } from '@/shared/schemas/actions/settings-profile';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsProfileRouteMessages,
  type SettingsProfileRouteMessages,
} from './settings-profile-route-messages';

type SettingsProfileRouteInput = {
  locale: unknown;
};

type SettingsProfileRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
};

type SettingsProfileUpdateInput = {
  locale: unknown;
  name: unknown;
  image: unknown;
};

type SettingsProfileUpdateDeps = SettingsProfileRouteResolverDeps & {
  updateUser?: (
    userId: string,
    updatedUser: {
      name?: string;
      image?: string;
    }
  ) => Promise<unknown>;
};

const canonicalPath = '/settings/profile' as const;
const migratedSettingsPaths = [
  '/settings/profile',
  '/settings/security',
] as const;

export async function resolveSettingsProfileRouteData(
  input: SettingsProfileRouteInput,
  deps: SettingsProfileRouteResolverDeps = {}
): Promise<SettingsProfileRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  const messages = await loadSettingsProfileRouteMessages(locale);
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
      head: buildSettingsProfileHead(messages, locale),
      shell: buildSettingsShellData(messages, locale),
      viewer: {
        signedIn: Boolean(signedInUser),
      },
      page: buildSettingsProfilePageData(messages, signedInUser),
    })
  ) as SettingsProfileRouteData;
}

export async function resolveSettingsProfileUpdate(
  input: SettingsProfileUpdateInput,
  deps: SettingsProfileUpdateDeps = {}
): Promise<SettingsProfileUpdateResult> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return { status: 'error', message: 'Invalid locale' };
  }

  const messages = await loadSettingsProfileRouteMessages(locale);
  if (!messages) {
    return { status: 'error', message: 'Invalid locale' };
  }

  const profile = getObject(messages.profile);
  const validation = getObject(profile.validation);
  const messageCopy = getObject(profile.messages);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  if (!signedInUser) {
    return {
      status: 'error',
      message: readString(profile.no_auth, 'Please sign in to continue'),
    };
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    return {
      status: 'error',
      message: readString(validation.name_required, 'Name is required'),
    };
  }

  const image = normalizeProfileImageValue(input.image);
  if (image === null) {
    return {
      status: 'error',
      message: readString(
        validation.image_invalid,
        'Avatar URL must be http(s) or site-relative'
      ),
    };
  }

  const result = await updateProfileUseCase(
    {
      userId: signedInUser.id,
      name,
      image,
    },
    { updateUser: deps.updateUser ?? updateAccountUser },
    readString(messageCopy.updated, 'Profile updated'),
    localePath(canonicalPath, locale)
  );

  return {
    ...result,
    profile: {
      email: signedInUser.email ?? '',
      name,
      image: image || null,
    },
  };
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

function buildSettingsProfileHead(
  messages: SettingsProfileRouteMessages,
  locale: string
) {
  const profile = getObject(messages.profile);
  const edit = getObject(profile.edit);
  const crumbs = getObject(edit.crumbs);
  const title = readString(crumbs.profile, 'Profile');
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const description = readString(edit.description, 'Update your profile');
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
  messages: SettingsProfileRouteMessages,
  locale: string
): SettingsShellData {
  const sidebar = getObject(messages.sidebar);

  return {
    title: readString(sidebar.title, 'Settings'),
    nav: {
      items: buildSettingsNavItems(messages, locale),
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

function buildSettingsNavItems(
  messages: SettingsProfileRouteMessages,
  locale: string
): SettingsShellNavItem[] {
  const sidebarItems = Array.isArray(getObject(messages.sidebar.nav).items)
    ? (getObject(messages.sidebar.nav).items as Array<Record<string, unknown>>)
    : [];

  return migratedSettingsPaths.map((path) => {
    const item = sidebarItems.find((entry) => entry.url === path) ?? {};

    return {
      title: readString(item.title, fallbackTitleForPath(path)),
      url: localePath(path, locale),
      icon: readOptionalString(item.icon),
      active: path === canonicalPath,
    };
  });
}

function buildSettingsProfilePageData(
  messages: SettingsProfileRouteMessages,
  signedInUser: AuthSessionUserIdentity | null
): SettingsProfileRouteData['page'] {
  const profile = getObject(messages.profile);
  const edit = getObject(profile.edit);
  const fields = getObject(profile.fields);

  return {
    noAuthMessage: readString(profile.no_auth, 'Please sign in to continue'),
    title: readString(edit.title, 'Profile'),
    description: readString(edit.description, 'Update your profile'),
    fields: {
      email: readString(fields.email, 'Email'),
      name: readString(fields.name, 'Name'),
      avatar: readString(fields.avatar, 'Avatar'),
    },
    profile: signedInUser
      ? {
          email: signedInUser.email ?? '',
          name: signedInUser.name ?? '',
          image: signedInUser.image,
        }
      : null,
    submitButtonTitle: readString(getObject(edit.buttons).submit, 'Save'),
  };
}

function fallbackTitleForPath(path: (typeof migratedSettingsPaths)[number]) {
  return path === '/settings/profile' ? 'Profile' : 'Security';
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
