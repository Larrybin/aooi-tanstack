import {
  MEMBER_BILLING_ACTIVE_STATUSES,
  readMemberBillingOverviewQuery,
} from '@/domains/billing/application/member-billing.query';
import { formatPaymentAmountCents } from '@/domains/billing/ui/format-money';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsBillingRouteData } from '@/surfaces/member/settings-billing/settings-billing.types';
import type { SettingsShellData } from '@/surfaces/member/settings-shell/settings-shell.types';

import {
  resolveSitePaymentCapability,
  type PaymentCapability,
} from '@/config/payment-capability';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { formatYmd } from '@/shared/lib/date/format-ymd';
import { buildCanonicalUrl, buildSeoHead } from '@/shared/seo/canonical';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

import {
  loadSettingsBillingRouteMessages,
  type SettingsBillingRouteMessages,
} from './settings-billing-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsBillingRouteInput = {
  locale: unknown;
  search?: unknown;
  page?: unknown;
  pageSize?: unknown;
  status?: unknown;
  order_no?: unknown;
  orderNo?: unknown;
};

type BillingStatusFilter = SettingsBillingRouteData['page']['query']['status'];

type BillingQuery = {
  page: number;
  pageSize: number;
  status: BillingStatusFilter;
  orderNo: string;
};

type BillingSubscriptionRecord = {
  id?: string | null;
  subscriptionNo?: string | null;
  paymentUserId?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  status?: string | null;
  amount?: number | null;
  currency?: string | null;
  planName?: string | null;
  currentPeriodStart?: Date | string | number | null;
  currentPeriodEnd?: Date | string | number | null;
  canceledEndAt?: Date | string | number | null;
  createdAt?: Date | string | number | null;
};

type BillingOverview = {
  currentSubscription?: BillingSubscriptionRecord | null;
  subscriptions: BillingSubscriptionRecord[];
  total: number;
};

type SettingsBillingRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  resolvePaymentCapability?: () => PaymentCapability;
  readBillingOverview?: (input: {
    userId: string;
    status?: string;
    page: number;
    limit: number;
  }) => Promise<BillingOverview>;
};

const canonicalPath = '/settings/billing' as const;
const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const billingStatusOptions = [
  'all',
  'active',
  'trialing',
  'paused',
  'expired',
  'pending_cancel',
  'canceled',
] as const satisfies readonly BillingStatusFilter[];

export async function resolveSettingsBillingRouteData(
  input: SettingsBillingRouteInput,
  deps: SettingsBillingRouteResolverDeps = {}
): Promise<SettingsBillingRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  const resolvePayment =
    deps.resolvePaymentCapability ?? resolveSitePaymentCapability;
  if (resolvePayment() === 'none') {
    return null;
  }

  const messages = await loadSettingsBillingRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const query = parseBillingQuery(input);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  const baseData = {
    locale,
    canonicalPath,
    head: buildSettingsBillingHead(messages, locale),
    shell: buildSettingsShellData(messages, locale),
    viewer: {
      signedIn: Boolean(signedInUser),
    },
  };

  if (!signedInUser) {
    return serializeRouteData({
      ...baseData,
      page: buildNoAuthBillingPageData(messages, locale),
    });
  }

  try {
    const overview = await (
      deps.readBillingOverview ?? readBillingOverviewFromDomain
    )({
      userId: signedInUser.id,
      status: query.status === 'all' ? undefined : query.status,
      page: query.page,
      limit: query.pageSize,
    });

    return serializeRouteData({
      ...baseData,
      page: buildSettingsBillingPageData(messages, locale, query, overview),
    });
  } catch {
    return serializeRouteData({
      ...baseData,
      page: buildSettingsBillingErrorPageData(messages, locale, query),
    });
  }
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

async function readBillingOverviewFromDomain(input: {
  userId: string;
  status?: string;
  page: number;
  limit: number;
}) {
  return readMemberBillingOverviewQuery(input);
}

function parseBillingQuery(input: SettingsBillingRouteInput): BillingQuery {
  const params = getSearchValues(input.search);
  const status = normalizeStatus(readQueryValue(params.status, input.status));

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
    status,
    orderNo:
      readQueryValue(params.orderNo, input.order_no) ??
      readQueryValue(null, input.orderNo) ??
      '',
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
      status: readSearchObjectValue(record.status),
      page: readSearchObjectValue(record.page),
      pageSize: readSearchObjectValue(record.pageSize),
      orderNo: readSearchObjectValue(record.order_no ?? record.orderNo),
    };
  }

  return {
    status: null,
    page: null,
    pageSize: null,
    orderNo: null,
  };
}

function getSearchParamsValues(params: URLSearchParams) {
  return {
    status: params.get('status'),
    page: params.get('page'),
    pageSize: params.get('pageSize'),
    orderNo: params.get('order_no'),
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

function normalizeStatus(value: string | null): BillingStatusFilter {
  if (billingStatusOptions.includes(value as BillingStatusFilter)) {
    return value as BillingStatusFilter;
  }

  return 'all';
}

function buildSettingsBillingHead(
  messages: SettingsBillingRouteMessages,
  locale: string
) {
  const billing = getObject(messages.billing);
  const view = getObject(billing.view);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title = readString(view.title, 'Current Plan');
  const description = readString(
    getObject(billing.list).title,
    'Subscriptions History'
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
  messages: SettingsBillingRouteMessages,
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

function buildNoAuthBillingPageData(
  messages: SettingsBillingRouteMessages,
  locale: string
): SettingsBillingRouteData['page'] {
  const billing = getObject(messages.billing);

  return {
    noAuthMessage: readString(
      getObject(billing.errors).no_auth,
      'Please sign in to continue'
    ),
    errorMessage: null,
    purchaseUrl: localePath('/pricing', locale),
    query: {
      page: defaultPage,
      pageSize: defaultPageSize,
      status: 'all',
      orderNo: '',
    },
    paymentCallback: null,
    currentSubscription: null,
    pagination: {
      total: 0,
      page: defaultPage,
      pageSize: defaultPageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildBillingLabels(messages),
    tabs: buildBillingTabs(messages, locale, 'all', defaultPageSize),
    records: [],
  };
}

function buildSettingsBillingPageData(
  messages: SettingsBillingRouteMessages,
  locale: string,
  query: BillingQuery,
  overview: BillingOverview
): SettingsBillingRouteData['page'] {
  return {
    noAuthMessage: readString(
      getObject(getObject(messages.billing).errors).no_auth,
      'Please sign in to continue'
    ),
    errorMessage: null,
    purchaseUrl: localePath('/pricing', locale),
    query,
    paymentCallback: buildPaymentCallback(locale, query),
    currentSubscription: serializeCurrentSubscription(
      messages,
      locale,
      overview.currentSubscription ?? null
    ),
    pagination: {
      total: overview.total,
      page: query.page,
      pageSize: query.pageSize,
      ...buildBillingPaginationLinks(
        locale,
        query.status,
        query.page,
        query.pageSize,
        overview.total
      ),
    },
    labels: buildBillingLabels(messages),
    tabs: buildBillingTabs(messages, locale, query.status, query.pageSize),
    records: overview.subscriptions.map((subscription) =>
      serializeSubscriptionRecord(locale, subscription)
    ),
  };
}

function buildSettingsBillingErrorPageData(
  messages: SettingsBillingRouteMessages,
  locale: string,
  query: BillingQuery
): SettingsBillingRouteData['page'] {
  return {
    noAuthMessage: readString(
      getObject(getObject(messages.billing).errors).no_auth,
      'Please sign in to continue'
    ),
    errorMessage: 'Billing could not be loaded',
    purchaseUrl: localePath('/pricing', locale),
    query,
    paymentCallback: buildPaymentCallback(locale, query),
    currentSubscription: null,
    pagination: {
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildBillingLabels(messages),
    tabs: buildBillingTabs(messages, locale, query.status, query.pageSize),
    records: [],
  };
}

function buildBillingLabels(messages: SettingsBillingRouteMessages) {
  const billing = getObject(messages.billing);
  const fields = getObject(billing.fields);
  const view = getObject(billing.view);
  const buttons = getObject(view.buttons);
  const list = getObject(billing.list);

  return {
    currentPlanTitle: readString(view.title, 'Current Plan'),
    noSubscription: readString(view.no_subscription, 'No plan'),
    subscribeButton: readString(buttons.subscribe, 'Subscribe'),
    adjustButton: readString(buttons.adjust, 'Adjust Plan'),
    listTitle: readString(list.title, 'Subscriptions History'),
    subscriptionNo: readString(fields.subscription_no, 'Subscription No'),
    interval: readString(fields.interval, 'Interval'),
    status: readString(fields.status, 'Status'),
    amount: readString(fields.amount, 'Amount'),
    createdAt: readString(fields.created_at, 'Created At'),
    currentPeriod: readString(fields.current_period, 'Current Period'),
    endTime: readString(fields.end_time, 'End Time'),
    copyAction: 'Copy',
    copySuccess: 'Copied',
    previousPage: 'Previous',
    nextPage: 'Next',
    empty: 'No subscription records',
    callbackTitle: 'Payment callback',
    callbackOrderNo: 'Order No',
    callbackClear: 'Clear status',
    callbackFailed: 'Failed to confirm payment',
    manageButton: readString(buttons.manage, 'Manage Subscription'),
    cancelButton: readString(buttons.cancel, 'Cancel Subscription'),
    action: readString(fields.action, 'Action'),
  };
}

function buildBillingTabs(
  messages: SettingsBillingRouteMessages,
  locale: string,
  activeStatus: BillingStatusFilter,
  pageSize: number
) {
  const tabs = getObject(getObject(messages.billing).list).tabs;
  const tabMessages = getObject(tabs);
  const options = [
    ['all', readString(tabMessages.all, 'All')],
    ['active', readString(tabMessages.active, 'Active')],
    ['trialing', readString(tabMessages.trialing, 'Trialing')],
    ['paused', readString(tabMessages.paused, 'Paused')],
    ['expired', readString(tabMessages.expired, 'Expired')],
    [
      'pending_cancel',
      readString(tabMessages.pending_cancel, 'Pending Cancel'),
    ],
    ['canceled', readString(tabMessages.canceled, 'Canceled')],
  ] as const;

  return options.map(([status, title]) => ({
    title,
    status,
    href: buildBillingTabHref(locale, status, pageSize),
    active: status === activeStatus,
  }));
}

function buildPaymentCallback(locale: string, query: BillingQuery) {
  if (!query.orderNo) {
    return null;
  }

  return {
    orderNo: query.orderNo,
    cleanUrl: buildBillingPageHref(
      locale,
      query.status,
      query.page,
      query.pageSize
    ),
  };
}

function buildBillingPaginationLinks(
  locale: string,
  status: BillingStatusFilter,
  page: number,
  pageSize: number,
  total: number
) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousPage = page > totalPages ? totalPages : page - 1;

  return {
    previousHref:
      total > 0 && page > 1
        ? buildBillingPageHref(locale, status, previousPage, pageSize)
        : null,
    nextHref:
      page < totalPages
        ? buildBillingPageHref(locale, status, page + 1, pageSize)
        : null,
  };
}

function buildBillingPageHref(
  locale: string,
  status: BillingStatusFilter,
  page: number,
  pageSize: number
) {
  const params = new URLSearchParams();
  if (status !== 'all') {
    params.set('status', status);
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

function buildBillingTabHref(
  locale: string,
  status: BillingStatusFilter,
  pageSize: number
) {
  const params = new URLSearchParams();
  if (status !== 'all') {
    params.set('status', status);
  }
  if (pageSize !== defaultPageSize) {
    params.set('pageSize', String(pageSize));
  }

  const query = params.toString();
  const path = localePath(canonicalPath, locale);
  return query ? `${path}?${query}` : path;
}

function serializeCurrentSubscription(
  messages: SettingsBillingRouteMessages,
  locale: string,
  subscription: BillingSubscriptionRecord | null
): SettingsBillingRouteData['page']['currentSubscription'] {
  if (!subscription) {
    return null;
  }

  return {
    subscriptionNo: subscription.subscriptionNo ?? '',
    planName:
      subscription.planName ||
      readString(
        getObject(getObject(messages.billing).view).no_subscription,
        'No plan'
      ),
    status: subscription.status ?? '',
    tip: buildCurrentSubscriptionTip(messages, subscription),
    manageHref:
      subscription.paymentUserId && subscription.subscriptionNo
        ? buildSubscriptionActionHref(
            locale,
            '/settings/billing/retrieve',
            subscription.subscriptionNo
          )
        : null,
  };
}

function buildCurrentSubscriptionTip(
  messages: SettingsBillingRouteMessages,
  subscription: BillingSubscriptionRecord
) {
  const view = getObject(getObject(messages.billing).view);
  const status = subscription.status ?? '';
  const isActive = MEMBER_BILLING_ACTIVE_STATUSES.includes(status as never);
  const template = isActive
    ? readString(view.tip, 'Your subscription will auto renew on {date}')
    : readString(
        view.end_tip,
        'Your subscription will be auto canceled on {date}'
      );
  const date = isActive
    ? formatYmd(subscription.currentPeriodEnd)
    : formatYmd(subscription.canceledEndAt);

  return template.replace('{date}', date);
}

function serializeSubscriptionRecord(
  locale: string,
  subscription: BillingSubscriptionRecord
): SettingsBillingRouteData['page']['records'][number] {
  return {
    id: subscription.id || subscription.subscriptionNo || '',
    subscriptionNo: subscription.subscriptionNo ?? '',
    interval: formatInterval(subscription),
    status: subscription.status ?? '',
    amount: formatPaymentAmountCents(
      subscription.amount,
      subscription.currency
    ),
    createdAt: formatYmd(subscription.createdAt),
    currentPeriod: `${formatYmd(subscription.currentPeriodStart)} ~ ${formatYmd(
      subscription.currentPeriodEnd
    )}`,
    endTime: formatYmd(subscription.canceledEndAt),
    actions: {
      cancelHref: isCancelableSubscription(subscription)
        ? buildSubscriptionActionHref(
            locale,
            '/settings/billing/cancel',
            subscription.subscriptionNo ?? ''
          )
        : null,
    },
  };
}

function isCancelableSubscription(subscription: BillingSubscriptionRecord) {
  return (
    Boolean(subscription.subscriptionNo) &&
    MEMBER_BILLING_ACTIVE_STATUSES.includes(
      (subscription.status ?? '') as never
    )
  );
}

function buildSubscriptionActionHref(
  locale: string,
  path: '/settings/billing/cancel' | '/settings/billing/retrieve',
  subscriptionNo: string
) {
  const params = new URLSearchParams({
    subscription_no: subscriptionNo,
  });
  return `${localePath(path, locale)}?${params}`;
}

function formatInterval(subscription: BillingSubscriptionRecord) {
  if (!subscription.interval || !subscription.intervalCount) {
    return '-';
  }

  return `${subscription.intervalCount}-${subscription.interval}`;
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as SettingsBillingRouteData;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
