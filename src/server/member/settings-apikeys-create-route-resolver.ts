import {
  createOwnApikeyUseCase,
  type AccountApikeyRecord,
  type AccountApikeyStatus,
} from '@/domains/account/application/use-cases';
import { ApikeyStatus, createApikey } from '@/domains/account/infra/apikey';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsApiKeysCreateRouteData } from '@/surfaces/member/settings-apikeys-create/settings-apikeys-create.types';
import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { getNonceStr, getUuid } from '@/shared/lib/hash';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsApiKeysRouteMessages,
  type SettingsApiKeysRouteMessages,
} from './settings-apikeys-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsApiKeysCreateRouteInput = {
  locale: unknown;
};

type SettingsApiKeyCreateInput = {
  locale: unknown;
  title: unknown;
};

type ApiKeyCreateDeps = {
  createApikey: (record: {
    id: string;
    userId: string;
    title: string;
    key: string;
    status: AccountApikeyStatus;
  }) => Promise<AccountApikeyRecord>;
  createId: () => string;
  createSecretKey: () => string;
};

type SettingsApiKeysCreateRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  apikeyCreateDeps?: ApiKeyCreateDeps;
};

const canonicalPath = '/settings/apikeys/create' as const;
const apiKeysPath = '/settings/apikeys' as const;

export async function resolveSettingsApiKeysCreateRouteData(
  input: SettingsApiKeysCreateRouteInput,
  deps: SettingsApiKeysCreateRouteResolverDeps = {}
): Promise<SettingsApiKeysCreateRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  const messages = await loadSettingsApiKeysRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();

  return serializeRouteData({
    locale,
    canonicalPath,
    head: buildSettingsApiKeysCreateHead(messages, locale),
    shell: buildSettingsShellData(messages, locale),
    viewer: {
      signedIn: Boolean(signedInUser),
    },
    page: buildSettingsApiKeysCreatePageData(messages, locale),
  });
}

export async function resolveSettingsApiKeyCreate(
  input: SettingsApiKeyCreateInput,
  deps: SettingsApiKeysCreateRouteResolverDeps = {}
) {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return { status: 'error' as const, message: 'Invalid locale' };
  }

  const messages = await loadSettingsApiKeysRouteMessages(locale);
  if (!messages) {
    return { status: 'error' as const, message: 'Invalid locale' };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    return { status: 'error' as const, message: 'title is required' };
  }

  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  if (!signedInUser) {
    return { status: 'error' as const, message: 'no auth' };
  }

  try {
    return await createOwnApikeyUseCase(
      {
        userId: signedInUser.id,
        title,
      },
      deps.apikeyCreateDeps ?? realApiKeyCreateDeps,
      'API Key created',
      localePath(apiKeysPath, locale)
    );
  } catch {
    return {
      status: 'error' as const,
      message: 'API key creation failed',
    };
  }
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

const realApiKeyCreateDeps: ApiKeyCreateDeps = {
  createApikey: async (record) =>
    mapApiKeyRecord(
      await createApikey({
        ...record,
        status: toInfraApikeyStatus(record.status),
      })
    ),
  createId: getUuid,
  createSecretKey: () => `sk-${getNonceStr(32)}`,
};

function toInfraApikeyStatus(status: AccountApikeyStatus) {
  return status === 'deleted' ? ApikeyStatus.DELETED : ApikeyStatus.ACTIVE;
}

function mapApiKeyRecord(record: AccountApikeyRecord): AccountApikeyRecord {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    key: record.key,
    status: record.status,
    deletedAt: record.deletedAt,
    createdAt: record.createdAt,
  };
}

function buildSettingsApiKeysCreateHead(
  messages: SettingsApiKeysRouteMessages,
  locale: string
) {
  const add = getObject(getObject(messages.apikeys).add);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title = readString(add.title, 'Create API Key');
  const head = buildSeoHead({
    title: `${title} - ${settingsTitle} - ${site.brand.appName}`,
    description: title,
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
  messages: SettingsApiKeysRouteMessages,
  locale: string
): SettingsShellData {
  const sidebar = getObject(messages.sidebar);

  return {
    title: readString(sidebar.title, 'Settings'),
    nav: {
      items: buildSettingsShellNavItems({
        activePath: apiKeysPath,
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

function buildSettingsApiKeysCreatePageData(
  messages: SettingsApiKeysRouteMessages,
  locale: string
): SettingsApiKeysCreateRouteData['page'] {
  const apikeys = getObject(messages.apikeys);
  const add = getObject(apikeys.add);
  const fields = getObject(apikeys.fields);
  const crumbs = getObject(add.crumbs);

  return {
    noAuthMessage: 'no auth',
    title: readString(add.title, 'Create API Key'),
    fields: {
      title: readString(fields.title, 'Title'),
    },
    submitButtonTitle: readString(getObject(add.buttons).submit, 'Create'),
    backHref: localePath(apiKeysPath, locale),
    labels: {
      apiKeys: readString(crumbs.apikeys, 'API Keys'),
    },
  };
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as SettingsApiKeysCreateRouteData;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
