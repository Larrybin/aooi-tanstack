import {
  ACCOUNT_CREDIT_TRANSACTION_TYPE,
  listOwnCreditsUseCase,
  readAccountRemainingCreditsUseCase,
  type AccountCreditRecord,
  type AccountCreditStatus,
  type AccountCreditTransactionType,
} from '@/domains/account/application/use-cases';
import {
  CreditStatus,
  CreditTransactionType,
  getCredits,
  getCreditsCount,
  getRemainingCredits,
} from '@/domains/account/infra/credit';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsCreditsRouteData } from '@/surfaces/member/settings-credits/settings-credits.types';
import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsCreditsRouteMessages,
  type SettingsCreditsRouteMessages,
} from './settings-credits-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsCreditsRouteInput = {
  locale: unknown;
  search?: unknown;
  page?: unknown;
  pageSize?: unknown;
  type?: unknown;
};

type CreditsFilterType = SettingsCreditsRouteData['page']['query']['type'];

type CreditsQuery = {
  page: number;
  pageSize: number;
  type: CreditsFilterType;
};

type CreditsListDeps = {
  getCredits: (params: {
    userId: string;
    status: AccountCreditStatus;
    transactionType?: AccountCreditTransactionType;
    page: number;
    limit: number;
  }) => Promise<AccountCreditRecord[]>;
  getCreditsCount: (params: {
    userId: string;
    status: AccountCreditStatus;
    transactionType?: AccountCreditTransactionType;
  }) => Promise<number>;
};

type SettingsCreditsRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  getRemainingCredits?: (userId: string) => Promise<number>;
  creditsListDeps?: CreditsListDeps;
};

const canonicalPath = '/settings/credits' as const;
const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;

export async function resolveSettingsCreditsRouteData(
  input: SettingsCreditsRouteInput,
  deps: SettingsCreditsRouteResolverDeps = {}
): Promise<SettingsCreditsRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  const messages = await loadSettingsCreditsRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const query = parseCreditsQuery(input);
  const transactionType = toCreditTransactionType(query.type);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  const baseData = {
    locale,
    canonicalPath,
    head: buildSettingsCreditsHead(messages, locale),
    shell: buildSettingsShellData(messages, locale),
    viewer: {
      signedIn: Boolean(signedInUser),
    },
  };

  if (!signedInUser) {
    return JSON.parse(
      JSON.stringify({
        ...baseData,
        page: buildNoAuthCreditsPageData(messages, locale),
      })
    ) as SettingsCreditsRouteData;
  }

  try {
    const [remainingCredits, ledger] = await Promise.all([
      readAccountRemainingCreditsUseCase(signedInUser.id, {
        getRemainingCredits: deps.getRemainingCredits ?? getRemainingCredits,
      }),
      listOwnCreditsUseCase(
        {
          userId: signedInUser.id,
          transactionType,
          page: query.page,
          limit: query.pageSize,
        },
        deps.creditsListDeps ?? realCreditsListDeps
      ),
    ]);

    return JSON.parse(
      JSON.stringify({
        ...baseData,
        page: buildSettingsCreditsPageData(messages, locale, query, {
          remainingCredits,
          ledger,
        }),
      })
    ) as SettingsCreditsRouteData;
  } catch {
    return JSON.parse(
      JSON.stringify({
        ...baseData,
        page: buildSettingsCreditsErrorPageData(messages, locale, query),
      })
    ) as SettingsCreditsRouteData;
  }
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

const realCreditsListDeps: CreditsListDeps = {
  getCredits: async ({ userId, status, transactionType, page, limit }) =>
    (
      await getCredits({
        userId,
        status: toInfraCreditStatus(status),
        transactionType: toInfraCreditTransactionType(transactionType),
        page,
        limit,
      })
    ).map(mapCreditRecord),
  getCreditsCount: ({ userId, status, transactionType }) =>
    getCreditsCount({
      userId,
      status: toInfraCreditStatus(status),
      transactionType: toInfraCreditTransactionType(transactionType),
    }),
};

function parseCreditsQuery(input: SettingsCreditsRouteInput): CreditsQuery {
  const params = getSearchValues(input.search);
  const type = normalizeType(readQueryValue(params.type, input.type));

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
    type,
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
      type: readSearchObjectValue(record.type),
      page: readSearchObjectValue(record.page),
      pageSize: readSearchObjectValue(record.pageSize),
    };
  }

  return {
    type: null,
    page: null,
    pageSize: null,
  };
}

function getSearchParamsValues(params: URLSearchParams) {
  return {
    type: params.get('type'),
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

function normalizeType(value: string | null): CreditsFilterType {
  if (
    value === ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT ||
    value === ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME
  ) {
    return value;
  }

  return 'all';
}

function toCreditTransactionType(
  value: SettingsCreditsRouteData['page']['query']['type']
): AccountCreditTransactionType | undefined {
  if (value === ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT) {
    return ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT;
  }

  if (value === ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME) {
    return ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME;
  }

  return undefined;
}

function toInfraCreditStatus(status: AccountCreditStatus) {
  if (status === 'active') {
    return CreditStatus.ACTIVE;
  }

  return CreditStatus.ACTIVE;
}

function toInfraCreditTransactionType(
  transactionType?: AccountCreditTransactionType
) {
  if (transactionType === ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT) {
    return CreditTransactionType.GRANT;
  }

  if (transactionType === ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME) {
    return CreditTransactionType.CONSUME;
  }

  return undefined;
}

function mapCreditRecord(
  record: Awaited<ReturnType<typeof getCredits>>[number]
): AccountCreditRecord {
  return {
    id: record.id,
    userId: record.userId,
    transactionNo: record.transactionNo,
    description: record.description,
    transactionType: record.transactionType,
    transactionScene: record.transactionScene,
    credits: record.credits,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

function buildSettingsCreditsHead(
  messages: SettingsCreditsRouteMessages,
  locale: string
) {
  const credits = getObject(messages.credits);
  const view = getObject(credits.view);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title = readString(view.title, 'Credits Balance');
  const list = getObject(credits.list);
  const description = readString(list.title, 'Credits Records');
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
  messages: SettingsCreditsRouteMessages,
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

function buildNoAuthCreditsPageData(
  messages: SettingsCreditsRouteMessages,
  locale: string
): SettingsCreditsRouteData['page'] {
  const credits = getObject(messages.credits);

  return {
    noAuthMessage: readString(credits.no_auth, 'Please sign in to continue'),
    errorMessage: null,
    remainingCredits: 0,
    purchaseUrl: '/pricing',
    query: {
      page: defaultPage,
      pageSize: defaultPageSize,
      type: 'all',
    },
    pagination: {
      total: 0,
      page: defaultPage,
      pageSize: defaultPageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildCreditsLabels(messages),
    tabs: buildCreditsTabs(messages, locale, 'all', defaultPageSize),
    records: [],
  };
}

function buildSettingsCreditsPageData(
  messages: SettingsCreditsRouteMessages,
  locale: string,
  query: ReturnType<typeof parseCreditsQuery>,
  result: {
    remainingCredits: number;
    ledger: Awaited<ReturnType<typeof listOwnCreditsUseCase>>;
  }
): SettingsCreditsRouteData['page'] {
  return {
    noAuthMessage: readString(
      getObject(messages.credits).no_auth,
      'Please sign in to continue'
    ),
    errorMessage: null,
    remainingCredits: result.remainingCredits,
    purchaseUrl: localePath('/pricing', locale),
    query,
    pagination: {
      total: result.ledger.total,
      page: result.ledger.page,
      pageSize: result.ledger.limit,
      ...buildCreditsPaginationLinks(
        locale,
        query.type,
        result.ledger.page,
        result.ledger.limit,
        result.ledger.total
      ),
    },
    labels: buildCreditsLabels(messages),
    tabs: buildCreditsTabs(messages, locale, query.type, query.pageSize),
    records: result.ledger.data.map(serializeCreditRecord),
  };
}

function buildSettingsCreditsErrorPageData(
  messages: SettingsCreditsRouteMessages,
  locale: string,
  query: ReturnType<typeof parseCreditsQuery>
): SettingsCreditsRouteData['page'] {
  return {
    noAuthMessage: readString(
      getObject(messages.credits).no_auth,
      'Please sign in to continue'
    ),
    errorMessage: 'Credits could not be loaded',
    remainingCredits: 0,
    purchaseUrl: localePath('/pricing', locale),
    query,
    pagination: {
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildCreditsLabels(messages),
    tabs: buildCreditsTabs(messages, locale, query.type, query.pageSize),
    records: [],
  };
}

function buildCreditsLabels(messages: SettingsCreditsRouteMessages) {
  const credits = getObject(messages.credits);
  const fields = getObject(credits.fields);
  const view = getObject(credits.view);
  const buttons = getObject(view.buttons);
  const list = getObject(credits.list);

  return {
    balanceTitle: readString(view.title, 'Credits Balance'),
    purchaseButton: readString(buttons.purchase, 'Purchase Credits'),
    listTitle: readString(list.title, 'Credits Records'),
    transactionNo: readString(fields.transaction_no, 'Transaction No'),
    description: readString(fields.description, 'Description'),
    type: readString(fields.type, 'Type'),
    scene: readString(fields.scene, 'Scene'),
    credits: readString(fields.credits, 'Credits'),
    expiresAt: readString(fields.expires_at, 'Expires At'),
    createdAt: readString(fields.created_at, 'Created At'),
    copyAction: readString(fields.action, 'Copy'),
    copySuccess: readString(getObject(credits.copy).success, 'Copied'),
    previousPage: 'Previous',
    nextPage: 'Next',
    empty: 'No credit records',
  };
}

function buildCreditsTabs(
  messages: SettingsCreditsRouteMessages,
  locale: string,
  activeType: SettingsCreditsRouteData['page']['query']['type'],
  pageSize: number
) {
  const tabs = getObject(getObject(messages.credits).list).tabs;
  const tabMessages = getObject(tabs);
  const options = [
    ['all', readString(tabMessages.all, 'All')],
    ['grant', readString(tabMessages.grant, 'Grant')],
    ['consume', readString(tabMessages.consume, 'Consume')],
  ] as const;

  return options.map(([type, title]) => ({
    title,
    type,
    href: buildCreditsTabHref(locale, type, pageSize),
    active: type === activeType,
  }));
}

function buildCreditsPaginationLinks(
  locale: string,
  type: SettingsCreditsRouteData['page']['query']['type'],
  page: number,
  pageSize: number,
  total: number
) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousPage = page > totalPages ? totalPages : page - 1;

  return {
    previousHref:
      total > 0 && page > 1
        ? buildCreditsPageHref(locale, type, previousPage, pageSize)
        : null,
    nextHref:
      page < totalPages
        ? buildCreditsPageHref(locale, type, page + 1, pageSize)
        : null,
  };
}

function buildCreditsPageHref(
  locale: string,
  type: SettingsCreditsRouteData['page']['query']['type'],
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams();
  if (type !== 'all') {
    params.set('type', type);
  }
  if (page !== defaultPage) {
    params.set('page', String(page));
  }
  if (pageSize !== defaultPageSize) {
    params.set('pageSize', String(pageSize));
  }

  const query = params.toString();
  const path = localePath(canonicalPath, locale);
  return query ? `${path}?${query}` : path;
}

function buildCreditsTabHref(
  locale: string,
  type: SettingsCreditsRouteData['page']['query']['type'],
  pageSize: number
) {
  const params = new URLSearchParams();
  if (type !== 'all') {
    params.set('type', type);
  }
  if (pageSize !== defaultPageSize) {
    params.set('pageSize', String(pageSize));
  }

  const query = params.toString();
  const path = localePath(canonicalPath, locale);
  return query ? `${path}?${query}` : path;
}

function serializeCreditRecord(
  record: AccountCreditRecord
): SettingsCreditsRouteData['page']['records'][number] {
  return {
    id: record.id,
    transactionNo: record.transactionNo ?? '',
    description: record.description ?? '',
    transactionType: record.transactionType ?? '',
    transactionScene: record.transactionScene ?? '',
    credits: record.credits ?? 0,
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    createdAt: record.createdAt ? record.createdAt.toISOString() : null,
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
