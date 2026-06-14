import {
  deleteOwnApikeyUseCase,
  renameOwnApikeyUseCase,
  requireOwnedApikeyUseCase,
  type AccountApikeyRecord,
  type AccountApikeyStatus,
} from '@/domains/account/application/use-cases';
import {
  ApikeyStatus,
  findApikeyById,
  updateApikey,
} from '@/domains/account/infra/apikey';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsApiKeysIdRouteData } from '@/surfaces/member/settings-apikeys-id/settings-apikeys-id.types';
import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsApiKeysRouteMessages,
  type SettingsApiKeysRouteMessages,
} from './settings-apikeys-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsApiKeysIdRouteInput = {
  locale: unknown;
  id: unknown;
  mode: 'edit' | 'delete';
};

type SettingsApiKeyUpdateInput = {
  locale: unknown;
  id: unknown;
  title: unknown;
};

type SettingsApiKeyDeleteInput = {
  locale: unknown;
  id: unknown;
  title: unknown;
};

type ApiKeyOwnershipDeps = {
  findApikeyById: (id: string) => Promise<AccountApikeyRecord | undefined>;
};

type ApiKeyMutationDeps = ApiKeyOwnershipDeps & {
  updateApikey: (
    id: string,
    update: {
      title?: string;
      status?: AccountApikeyStatus;
      deletedAt?: Date;
    }
  ) => Promise<AccountApikeyRecord>;
};

type SettingsApiKeysIdRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  apikeyOwnershipDeps?: ApiKeyOwnershipDeps;
  apikeyMutationDeps?: ApiKeyMutationDeps;
};

const apiKeysPath = '/settings/apikeys' as const;

export async function resolveSettingsApiKeysIdRouteData(
  input: SettingsApiKeysIdRouteInput,
  deps: SettingsApiKeysIdRouteResolverDeps = {}
): Promise<SettingsApiKeysIdRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  const id = typeof input.id === 'string' ? input.id : '';
  if (!locale || !id) {
    return null;
  }

  const messages = await loadSettingsApiKeysRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const canonicalPath = buildCanonicalPath(input.mode, id);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  const baseData = {
    locale,
    canonicalPath,
    head: buildSettingsApiKeysIdHead(
      messages,
      locale,
      canonicalPath,
      input.mode
    ),
    shell: buildSettingsShellData(messages, locale, canonicalPath),
    viewer: {
      signedIn: Boolean(signedInUser),
    },
  };

  if (!signedInUser) {
    return serializeRouteData({
      ...baseData,
      page: buildMessagePageData(messages, locale, input.mode, 'no auth'),
    });
  }

  const apikey = await requireOwnedApikeyUseCase(
    {
      apikeyId: id,
      userId: signedInUser.id,
    },
    deps.apikeyOwnershipDeps ?? realApiKeyOwnershipDeps
  );

  if (!apikey) {
    return serializeRouteData({
      ...baseData,
      page: buildMessagePageData(messages, locale, input.mode, 'no permission'),
    });
  }

  return serializeRouteData({
    ...baseData,
    page: buildSettingsApiKeysIdPageData(messages, locale, input.mode, apikey),
  });
}

export async function resolveSettingsApiKeyUpdate(
  input: SettingsApiKeyUpdateInput,
  deps: SettingsApiKeysIdRouteResolverDeps = {}
) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) {
    return { status: 'error' as const, message: 'title is required' };
  }

  const parsed = await parseMutationInput(input, deps);
  if (parsed.status === 'error') {
    return { status: 'error' as const, message: parsed.message };
  }

  try {
    const result = await renameOwnApikeyUseCase(
      {
        apikeyId: parsed.apikey.id,
        userId: parsed.user.id,
        title,
      },
      deps.apikeyMutationDeps ?? realApiKeyMutationDeps,
      'API Key updated',
      localePath(apiKeysPath, parsed.locale)
    );

    return result ?? { status: 'error' as const, message: 'no permission' };
  } catch {
    return { status: 'error' as const, message: 'API key update failed' };
  }
}

export async function resolveSettingsApiKeyDelete(
  input: SettingsApiKeyDeleteInput,
  deps: SettingsApiKeysIdRouteResolverDeps = {}
) {
  if (typeof input.title !== 'string' || input.title.trim() === '') {
    return { status: 'error' as const, message: 'title is required' };
  }

  const parsed = await parseMutationInput(input, deps);
  if (parsed.status === 'error') {
    return { status: 'error' as const, message: parsed.message };
  }

  try {
    const result = await deleteOwnApikeyUseCase(
      {
        apikeyId: parsed.apikey.id,
        userId: parsed.user.id,
      },
      deps.apikeyMutationDeps ?? realApiKeyMutationDeps,
      'API Key deleted',
      localePath(apiKeysPath, parsed.locale)
    );

    return result ?? { status: 'error' as const, message: 'no permission' };
  } catch {
    return { status: 'error' as const, message: 'API key deletion failed' };
  }
}

async function parseMutationInput(
  input: SettingsApiKeyUpdateInput | SettingsApiKeyDeleteInput,
  deps: SettingsApiKeysIdRouteResolverDeps
): Promise<
  | {
      status: 'success';
      locale: string;
      user: AuthSessionUserIdentity;
      apikey: AccountApikeyRecord;
    }
  | { status: 'error'; message: string }
> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return { status: 'error', message: 'Invalid locale' };
  }

  const id = typeof input.id === 'string' ? input.id : '';
  if (!id) {
    return { status: 'error', message: 'no permission' };
  }

  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const user = await readSignedInUserIdentity();
  if (!user) {
    return { status: 'error', message: 'no auth' };
  }

  const apikey = await requireOwnedApikeyUseCase(
    {
      apikeyId: id,
      userId: user.id,
    },
    deps.apikeyMutationDeps ?? realApiKeyMutationDeps
  );
  if (!apikey) {
    return { status: 'error', message: 'no permission' };
  }

  return { status: 'success', locale, user, apikey };
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

const realApiKeyOwnershipDeps: ApiKeyOwnershipDeps = {
  findApikeyById: async (id) => mapApiKeyRecord(await findApikeyById(id)),
};

const realApiKeyMutationDeps: ApiKeyMutationDeps = {
  ...realApiKeyOwnershipDeps,
  updateApikey: async (id, update) =>
    mapApiKeyRecordRequired(
      await updateApikey(id, {
        ...update,
        status: update.status ? toInfraApikeyStatus(update.status) : undefined,
      })
    ),
};

function toInfraApikeyStatus(status: AccountApikeyStatus) {
  return status === 'deleted' ? ApikeyStatus.DELETED : ApikeyStatus.ACTIVE;
}

function mapApiKeyRecord(
  record: AccountApikeyRecord | undefined
): AccountApikeyRecord | undefined {
  if (!record) {
    return undefined;
  }

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

function mapApiKeyRecordRequired(record: AccountApikeyRecord) {
  return mapApiKeyRecord(record) as AccountApikeyRecord;
}

function buildCanonicalPath(mode: 'edit' | 'delete', id: string) {
  return `${apiKeysPath}/${id}/${mode}` as SettingsApiKeysIdRouteData['canonicalPath'];
}

function buildSettingsApiKeysIdHead(
  messages: SettingsApiKeysRouteMessages,
  locale: string,
  canonicalPath: SettingsApiKeysIdRouteData['canonicalPath'],
  mode: 'edit' | 'delete'
) {
  const apikeys = getObject(messages.apikeys);
  const pageCopy = getObject(apikeys[mode]);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title = readString(
    pageCopy.title,
    mode === 'edit' ? 'Edit API Key' : 'Delete API Key'
  );
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
  locale: string,
  canonicalPath: SettingsApiKeysIdRouteData['canonicalPath']
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

function buildMessagePageData(
  messages: SettingsApiKeysRouteMessages,
  locale: string,
  mode: 'edit' | 'delete',
  message: string
): SettingsApiKeysIdRouteData['page'] {
  return {
    ...buildSettingsApiKeysIdPageData(messages, locale, mode, null),
    message,
  };
}

function buildSettingsApiKeysIdPageData(
  messages: SettingsApiKeysRouteMessages,
  locale: string,
  mode: 'edit' | 'delete',
  apikey: AccountApikeyRecord | null
): SettingsApiKeysIdRouteData['page'] {
  const apikeys = getObject(messages.apikeys);
  const pageCopy = getObject(apikeys[mode]);
  const fields = getObject(apikeys.fields);
  const crumbs = getObject(pageCopy.crumbs);
  const buttons = getObject(pageCopy.buttons);

  return {
    mode,
    message: null,
    title: readString(
      pageCopy.title,
      mode === 'edit' ? 'Edit API Key' : 'Delete API Key'
    ),
    noAuthMessage: 'no auth',
    noPermissionMessage: 'no permission',
    backHref: localePath(apiKeysPath, locale),
    labels: {
      apiKeys: readString(crumbs.apikeys, 'API Keys'),
      title: readString(fields.title, 'Title'),
      key: readString(fields.key, 'Key'),
      submit: readString(
        buttons.submit,
        mode === 'edit' ? 'Update' : 'Confirm Delete'
      ),
    },
    apikey: apikey ? serializeApiKeyForMode(mode, apikey) : null,
  };
}

function serializeApiKeyForMode(
  mode: 'edit' | 'delete',
  apikey: AccountApikeyRecord
) {
  const baseApiKey = {
    id: apikey.id,
    title: apikey.title ?? '',
  };

  if (mode === 'edit') {
    return baseApiKey;
  }

  return {
    ...baseApiKey,
    key: apikey.key ?? '',
  };
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as SettingsApiKeysIdRouteData;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
