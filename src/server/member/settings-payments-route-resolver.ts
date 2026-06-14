import { listMemberPaymentsQuery } from '@/domains/billing/application/member-billing.query';
import { PaymentType } from '@/domains/billing/domain/payment';
import { formatPaymentAmountCents } from '@/domains/billing/ui/format-money';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type { SettingsPaymentsRouteData } from '@/surfaces/member/settings-payments/settings-payments.types';
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
  loadSettingsPaymentsRouteMessages,
  type SettingsPaymentsRouteMessages,
} from './settings-payments-route-messages';
import { buildSettingsShellNavItems } from './settings-shell-route-data';

type SettingsPaymentsRouteInput = {
  locale: unknown;
  search?: unknown;
  page?: unknown;
  pageSize?: unknown;
  type?: unknown;
  order_no?: unknown;
  orderNo?: unknown;
};

type PaymentTypeFilter = SettingsPaymentsRouteData['page']['query']['type'];

type PaymentsQuery = {
  page: number;
  pageSize: number;
  type: PaymentTypeFilter;
  orderNo: string;
};

type PaymentOrderRecord = {
  id?: string | null;
  orderNo?: string | null;
  productName?: string | null;
  status?: string | null;
  paymentType?: string | null;
  amount?: number | null;
  currency?: string | null;
  paymentAmount?: number | null;
  paymentCurrency?: string | null;
  discountAmount?: number | null;
  discountCurrency?: string | null;
  createdAt?: Date | string | number | null;
  invoiceId?: string | null;
  invoiceUrl?: string | null;
};

type PaymentsOverview = {
  orders: PaymentOrderRecord[];
  total: number;
};

type SettingsPaymentsRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  resolvePaymentCapability?: () => PaymentCapability;
  readPayments?: (input: {
    userId: string;
    paymentType?: PaymentType;
    page: number;
    limit: number;
  }) => Promise<PaymentsOverview>;
};

const canonicalPath = '/settings/payments' as const;
const defaultPage = 1;
const defaultPageSize = 20;
const maxPageSize = 100;
const paymentTypeOptions = [
  'all',
  'one-time',
  'subscription',
  'renew',
] as const satisfies readonly PaymentTypeFilter[];

export async function resolveSettingsPaymentsRouteData(
  input: SettingsPaymentsRouteInput,
  deps: SettingsPaymentsRouteResolverDeps = {}
): Promise<SettingsPaymentsRouteData | null> {
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

  const messages = await loadSettingsPaymentsRouteMessages(locale);
  if (!messages) {
    return null;
  }

  const query = parsePaymentsQuery(input);
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  const baseData = {
    locale,
    canonicalPath,
    head: buildSettingsPaymentsHead(messages, locale),
    shell: buildSettingsShellData(messages, locale),
    viewer: {
      signedIn: Boolean(signedInUser),
    },
  };

  if (!signedInUser) {
    return serializeRouteData({
      ...baseData,
      page: buildNoAuthPaymentsPageData(messages, locale),
    });
  }

  try {
    const overview = await (deps.readPayments ?? readPaymentsFromDomain)({
      userId: signedInUser.id,
      paymentType: toPaymentType(query.type),
      page: query.page,
      limit: query.pageSize,
    });

    return serializeRouteData({
      ...baseData,
      page: buildSettingsPaymentsPageData(messages, locale, query, overview),
    });
  } catch {
    return serializeRouteData({
      ...baseData,
      page: buildSettingsPaymentsErrorPageData(messages, locale, query),
    });
  }
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

async function readPaymentsFromDomain(input: {
  userId: string;
  paymentType?: PaymentType;
  page: number;
  limit: number;
}) {
  return listMemberPaymentsQuery(input);
}

function parsePaymentsQuery(input: SettingsPaymentsRouteInput): PaymentsQuery {
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
      type: readSearchObjectValue(record.type),
      page: readSearchObjectValue(record.page),
      pageSize: readSearchObjectValue(record.pageSize),
      orderNo: readSearchObjectValue(record.order_no ?? record.orderNo),
    };
  }

  return {
    type: null,
    page: null,
    pageSize: null,
    orderNo: null,
  };
}

function getSearchParamsValues(params: URLSearchParams) {
  return {
    type: params.get('type'),
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

function normalizeType(value: string | null): PaymentTypeFilter {
  if (paymentTypeOptions.includes(value as PaymentTypeFilter)) {
    return value as PaymentTypeFilter;
  }

  return 'all';
}

function toPaymentType(value: PaymentTypeFilter) {
  if (value === PaymentType.ONE_TIME) {
    return PaymentType.ONE_TIME;
  }

  if (value === PaymentType.SUBSCRIPTION) {
    return PaymentType.SUBSCRIPTION;
  }

  if (value === PaymentType.RENEW) {
    return PaymentType.RENEW;
  }

  return undefined;
}

function buildSettingsPaymentsHead(
  messages: SettingsPaymentsRouteMessages,
  locale: string
) {
  const payments = getObject(messages.payments);
  const list = getObject(payments.list);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title = readString(list.title, 'Payments');
  const description = readString(list.description, 'View your payments');
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
  messages: SettingsPaymentsRouteMessages,
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

function buildNoAuthPaymentsPageData(
  messages: SettingsPaymentsRouteMessages,
  locale: string
): SettingsPaymentsRouteData['page'] {
  return {
    noAuthMessage: 'no auth',
    errorMessage: null,
    paymentCallback: null,
    query: {
      page: defaultPage,
      pageSize: defaultPageSize,
      type: 'all',
      orderNo: '',
    },
    pagination: {
      total: 0,
      page: defaultPage,
      pageSize: defaultPageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildPaymentsLabels(messages),
    tabs: buildPaymentsTabs(messages, locale, 'all', defaultPageSize),
    records: [],
  };
}

function buildSettingsPaymentsPageData(
  messages: SettingsPaymentsRouteMessages,
  locale: string,
  query: PaymentsQuery,
  overview: PaymentsOverview
): SettingsPaymentsRouteData['page'] {
  return {
    noAuthMessage: 'no auth',
    errorMessage: null,
    paymentCallback: buildPaymentCallback(locale, query),
    query,
    pagination: {
      total: overview.total,
      page: query.page,
      pageSize: query.pageSize,
      ...buildPaymentsPaginationLinks(
        locale,
        query.type,
        query.page,
        query.pageSize,
        overview.total
      ),
    },
    labels: buildPaymentsLabels(messages),
    tabs: buildPaymentsTabs(messages, locale, query.type, query.pageSize),
    records: overview.orders.map((order) =>
      serializePaymentRecord(locale, order)
    ),
  };
}

function buildSettingsPaymentsErrorPageData(
  messages: SettingsPaymentsRouteMessages,
  locale: string,
  query: PaymentsQuery
): SettingsPaymentsRouteData['page'] {
  return {
    noAuthMessage: 'no auth',
    errorMessage: 'Payments could not be loaded',
    paymentCallback: buildPaymentCallback(locale, query),
    query,
    pagination: {
      total: 0,
      page: query.page,
      pageSize: query.pageSize,
      previousHref: null,
      nextHref: null,
    },
    labels: buildPaymentsLabels(messages),
    tabs: buildPaymentsTabs(messages, locale, query.type, query.pageSize),
    records: [],
  };
}

function buildPaymentCallback(locale: string, query: PaymentsQuery) {
  const normalizedOrderNo = query.orderNo.trim();
  if (!normalizedOrderNo) {
    return null;
  }

  return {
    orderNo: normalizedOrderNo,
    cleanUrl: buildPaymentsPageHref(
      locale,
      query.type,
      query.page,
      query.pageSize
    ),
  };
}

function buildPaymentsLabels(messages: SettingsPaymentsRouteMessages) {
  const payments = getObject(messages.payments);
  const fields = getObject(payments.fields);
  const actions = getObject(fields.actions);
  const list = getObject(payments.list);

  return {
    listTitle: readString(list.title, 'Payments'),
    listDescription: readString(list.description, 'View your payments'),
    orderNo: readString(fields.order_no, 'Order No'),
    productName: readString(fields.product_name, 'Product Name'),
    status: readString(fields.status, 'Status'),
    type: readString(fields.type, 'Type'),
    price: readString(fields.price, 'Price'),
    paidAmount: readString(fields.paid_amount, 'Paid Amount'),
    discountAmount: readString(fields.discount_amount, 'Discount Amount'),
    createdAt: readString(fields.created_at, 'Created At'),
    invoice: readString(actions.view_invoice, 'View Invoice'),
    copyAction: 'Copy',
    copySuccess: 'Copied',
    previousPage: 'Previous',
    nextPage: 'Next',
    empty: 'No payment records',
    callbackTitle: 'Payment callback',
    callbackOrderNo: 'Order No',
    callbackClear: 'Clear status',
    callbackFailed: 'Failed to confirm payment',
  };
}

function buildPaymentsTabs(
  messages: SettingsPaymentsRouteMessages,
  locale: string,
  activeType: PaymentTypeFilter,
  pageSize: number
) {
  const tabs = getObject(getObject(messages.payments).list).tabs;
  const tabMessages = getObject(tabs);
  const options = [
    ['all', readString(tabMessages.all, 'All')],
    [PaymentType.ONE_TIME, readString(tabMessages['one-time'], 'One-Time')],
    [
      PaymentType.SUBSCRIPTION,
      readString(tabMessages.subscription, 'Subscription'),
    ],
    [PaymentType.RENEW, readString(tabMessages.renew, 'Renew')],
  ] as const;

  return options.map(([type, title]) => ({
    title,
    type,
    href: buildPaymentsTabHref(locale, type, pageSize),
    active: type === activeType,
  }));
}

function buildPaymentsPaginationLinks(
  locale: string,
  type: PaymentTypeFilter,
  page: number,
  pageSize: number,
  total: number
) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const previousPage = page > totalPages ? totalPages : page - 1;

  return {
    previousHref:
      total > 0 && page > 1
        ? buildPaymentsPageHref(locale, type, previousPage, pageSize)
        : null,
    nextHref:
      page < totalPages
        ? buildPaymentsPageHref(locale, type, page + 1, pageSize)
        : null,
  };
}

function buildPaymentsPageHref(
  locale: string,
  type: PaymentTypeFilter,
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

function buildPaymentsTabHref(
  locale: string,
  type: PaymentTypeFilter,
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

function serializePaymentRecord(
  locale: string,
  order: PaymentOrderRecord
): SettingsPaymentsRouteData['page']['records'][number] {
  return {
    id: order.id || order.orderNo || '',
    orderNo: order.orderNo ?? '',
    productName: order.productName ?? '',
    status: order.status ?? '',
    type: order.paymentType ?? '',
    price: formatPaymentAmountCents(order.amount, order.currency),
    paidAmount: formatPaymentAmountCents(
      order.paymentAmount,
      order.paymentCurrency
    ),
    discountAmount: formatPaymentAmountCents(
      order.discountAmount,
      order.discountCurrency
    ),
    createdAt: formatYmd(order.createdAt),
    invoiceHref: buildInvoiceHref(locale, order),
    invoiceExternal: Boolean(order.invoiceUrl),
  };
}

function buildInvoiceHref(locale: string, order: PaymentOrderRecord) {
  if (order.invoiceUrl) {
    return order.invoiceUrl;
  }

  if (!order.invoiceId || !order.orderNo) {
    return null;
  }

  return `${localePath('/settings/invoices/retrieve', locale)}?order_no=${encodeURIComponent(
    order.orderNo
  )}`;
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as SettingsPaymentsRouteData;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
