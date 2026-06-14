import {
  listOwnApikeysUseCase,
  type AccountApikeyRecord,
  type AccountApikeyStatus,
} from '@/domains/account/application/use-cases';
import {
  ApikeyStatus,
  getApikeys,
  getApikeysCount,
} from '@/domains/account/infra/apikey';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsApiKeysRouteData } from '@/surfaces/member/settings-apikeys/settings-apikeys.types';
import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { formatYmd } from '@/shared/lib/date/format-ymd';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsApiKeysRouteMessages,
  type SettingsApiKeysRouteMessages,
} from './settings-apikeys-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsApiKeysRouteInput = {
  locale: unknown;
  search?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

type ApiKeysQuery = {
  page: number;
  pageSize: number;
};

type ApiKeysListDeps = {
  getApikeys: (params: {
    userId: string;
    status: AccountApikeyStatus;
    page: number;
    limit: number;
  }) => Promise<AccountApikeyRecord[]>;
  getApikeysCount: (params: {
    userId: string;
    status: AccountApikeyStatus;
  }) => Promise<number>;
};

type SettingsApiKeysRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  apikeyListDeps?: ApiKeysListDeps;
};

const canonicalPath = '/settings/apikeys' as const;
const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

export async function resolveSettingsApiKeysRouteData(
  input: SettingsApiKeysRouteInput,
  deps: SettingsApiKeysRouteResolverDeps = {}
): Promise<SettingsApiKeysRouteData | null> {
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

  const query = parseApiKeysQuery(input);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  const baseData = {
    locale,
    canonicalPath,
    head: buildSettingsApiKeysHead(messages, locale),
    shell: buildSettingsShellData(messages, locale),
    viewer: {
      signedIn: Boolean(signedInUser),
    },
  };

  if (!signedInUser) {
    return serializeRouteData({
      ...baseData,
      page: buildNoAuthApiKeysPageData(messages, locale),
    });
  }

  try {
    const list = await listOwnApikeysUseCase(
      {
        userId: signedInUser.id,
        page: query.page,
        limit: query.pageSize,
      },
      deps.apikeyListDeps ?? realApiKeysListDeps
    );

    return serializeRouteData({
      ...baseData,
      page: buildSettingsApiKeysPageData(messages, locale, query, list),
    });
  } catch {
    return serializeRouteData({
      ...baseData,
      page: buildSettingsApiKeysErrorPageData(messages, locale, query),
    });
  }
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

const realApiKeysListDeps: ApiKeysListDeps = {
  getApikeys: async ({ userId, status, page, limit }) =>
    (
      await getApikeys({
        userId,
        status: toInfraApikeyStatus(status),
        page,
        limit,
      })
    ).map(mapApiKeyRecord),
  getApikeysCount: ({ userId, status }) =>
    getApikeysCount({
      userId,
      status: toInfraApikeyStatus(status),
    }),
};

function parseApiKeysQuery(input: SettingsApiKeysRouteInput): ApiKeysQuery {
  const params = getSearchValues(input.search);

  return {
    page: normalizePositiveInteger(
      readQueryValue(params.page, input.page),
      defaultPage
    ),
    pageSize: Math.min(
      normalizePositiveInteger(
        readQueryValue(params.pageSize, input.pageSize),
        defaultPageSize
      ),
      maxPageSize
    ),
  };
}

function getSearchValues(search: unknown) {
  if (typeof search === 'string') {
    return getSearchParamsValues(
      new URLSearchParams(search.replace(/^\?/, ''))
    );
  }

  if (search instanceof URLSearchParams) {
    return getSearchParamsValues(search);
  }

  if (typeof search === 'object' && search !== null && !Array.isArray(search)) {
    const record = search as Record<string, unknown>;
    return {
      page: readSearchObjectValue(record.page),
      pageSize: readSearchObjectValue(record.pageSize),
    };
  }

  return {
    page: null,
    pageSize: null,
  };
}

function getSearchParamsValues(params: URLSearchParams) {
  return {
    page: params.get('page'),
    pageSize: params.get('pageSize'),
  };
}

function readSearchObjectValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return readSearchObjectValue(value[0]);
  }

  return null;
}

function readQueryValue(searchValue: string | null, inputValue: unknown) {
  return searchValue ?? (typeof inputValue === 'string' ? inputValue : null);
}

function normalizePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

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

function buildSettingsApiKeysHead(
  messages: SettingsApiKeysRouteMessages,
  locale: string
) {
  const apikeys = getObject(messages.apikeys);
  const list = getObject(apikeys.list);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title = readString(list.title, 'API Keys');
  const description = readString(list.description, 'Manage your API keys');
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
  messages: SettingsApiKeysRouteMessages,
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

function buildNoAuthApiKeysPageData(
  messages: SettingsApiKeysRouteMessages,
  locale: string
): SettingsApiKeysRouteData['page'] {
  return {
    noAuthMessage: 'no auth',
    errorMessage: null,
    createHref: localePath('/settings/apikeys/create', locale),
    query: {
      page: defaultPage,
      pageSize: defaultPageSize,
    },
    pagination: {
      total: 0,
      page: defaultPage,
      pageSize: defaultPageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildApiKeysLabels(messages),
    records: [],
  };
}

function buildSettingsApiKeysPageData(
  messages: SettingsApiKeysRouteMessages,
  locale: string,
  query: ApiKeysQuery,
  list: {
    data: AccountApikeyRecord[];
    total: number;
    page: number;
    limit: number;
  }
): SettingsApiKeysRouteData['page'] {
  return {
    noAuthMessage: 'no auth',
    errorMessage: null,
    createHref: localePath('/settings/apikeys/create', locale),
    query,
    pagination: {
      total: list.total,
      page: list.page,
      pageSize: list.limit,
      ...buildApiKeysPaginationLinks(locale, list.page, list.limit, list.total),
    },
    labels: buildApiKeysLabels(messages),
    records: list.data.map((record) => serializeApiKeyRecord(locale, record)),
  };
}

function buildSettingsApiKeysErrorPageData(
  messages: SettingsApiKeysRouteMessages,
  locale: string,
  query: ApiKeysQuery
): SettingsApiKeysRouteData['page'] {
  return {
    noAuthMessage: 'no auth',
    errorMessage: 'API keys could not be loaded',
    createHref: localePath('/settings/apikeys/create', locale),
    query,
    pagination: {
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildApiKeysLabels(messages),
    records: [],
  };
}

function buildApiKeysLabels(messages: SettingsApiKeysRouteMessages) {
  const apikeys = getObject(messages.apikeys);
  const fields = getObject(apikeys.fields);
  const list = getObject(apikeys.list);
  const listButtons = getObject(list.buttons);

  return {
    listTitle: readString(list.title, 'API Keys'),
    title: readString(fields.title, 'Title'),
    key: readString(fields.key, 'Key'),
    createdAt: readString(fields.created_at, 'Created At'),
    action: readString(fields.action, 'Action'),
    create: readString(listButtons.add, 'Create API Key'),
    edit: readString(listButtons.edit, 'Edit'),
    delete: readString(listButtons.delete, 'Delete'),
    copyAction: 'Copy',
    copySuccess: 'Copied',
    previousPage: 'Previous',
    nextPage: 'Next',
    empty: readString(list.empty_message, 'No API Keys'),
  };
}

function buildApiKeysPaginationLinks(
  locale: string,
  page: number,
  pageSize: number,
  total: number
) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousPage = page > totalPages ? totalPages : page - 1;

  return {
    previousHref:
      total > 0 && page > 1
        ? buildApiKeysPageHref(locale, previousPage, pageSize)
        : null,
    nextHref:
      page < totalPages
        ? buildApiKeysPageHref(locale, page + 1, pageSize)
        : null,
  };
}

function buildApiKeysPageHref(locale: string, page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (page > 1) {
    params.set('page', String(page));
  }
  if (pageSize !== defaultPageSize) {
    params.set('pageSize', String(pageSize));
  }

  const queryString = params.toString();
  const path = localePath(canonicalPath, locale);
  return queryString ? `${path}?${queryString}` : path;
}

function serializeApiKeyRecord(
  locale: string,
  record: AccountApikeyRecord
): SettingsApiKeysRouteData['page']['records'][number] {
  return {
    id: record.id,
    title: record.title ?? '',
    key: record.key ?? '',
    createdAt: formatYmd(record.createdAt),
    editHref: localePath(`/settings/apikeys/${record.id}/edit`, locale),
    deleteHref: localePath(`/settings/apikeys/${record.id}/delete`, locale),
  };
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as SettingsApiKeysRouteData;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
