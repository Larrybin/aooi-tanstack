import {
  cancelMemberSubscription,
  readMemberCancelableSubscription,
  retrieveMemberBillingPortalUrl,
  retrieveMemberInvoiceUrl,
} from '@/domains/billing/application/member-billing.actions';
import { formatPaymentAmountCents } from '@/domains/billing/ui/format-money';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { site } from '@/site';
import type {
  SettingsBillingActionRouteData,
  SettingsBillingCancelResult,
} from '@/surfaces/member/settings-billing-action/settings-billing-action.types';
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

type SettingsBillingActionRouteInput = {
  locale: unknown;
  search?: unknown;
  subscription_no?: unknown;
  subscriptionNo?: unknown;
  order_no?: unknown;
  orderNo?: unknown;
};

type SettingsBillingCancelInput = {
  locale: unknown;
  subscriptionNo: unknown;
};

type CancelableSubscriptionRecord = {
  subscriptionNo?: string | null;
  interval?: string | null;
  intervalCount?: number | null;
  amount?: number | null;
  currency?: string | null;
  createdAt?: Date | string | number | null;
  currentPeriodStart?: Date | string | number | null;
  currentPeriodEnd?: Date | string | number | null;
};

type SettingsBillingActionRouteResolverDeps = {
  readSignedInUserIdentity?: () => Promise<AuthSessionUserIdentity | null>;
  resolvePaymentCapability?: () => PaymentCapability;
  readCancelableSubscription?: (input: {
    subscriptionNo: string;
    actorUserId: string;
  }) => Promise<
    | { status: 'ok'; subscription: CancelableSubscriptionRecord }
    | {
        status:
          | 'not_found'
          | 'forbidden'
          | 'missing_subscription_target'
          | 'payment_unavailable';
      }
  >;
  cancelSubscription?: (input: {
    subscriptionNo: string;
    actorUserId: string;
  }) => Promise<
    | { status: 'ok'; nextStatus?: string }
    | {
        status:
          | 'not_found'
          | 'forbidden'
          | 'invalid_status'
          | 'missing_provider'
          | 'cancel_failed';
      }
  >;
  retrieveBillingPortal?: (input: {
    subscriptionNo: string;
    actorUserId: string;
    returnUrl: string;
  }) => Promise<
    | { status: 'ok'; billingUrl: string }
    | {
        status:
          | 'not_found'
          | 'forbidden'
          | 'missing_customer'
          | 'missing_billing_url';
      }
  >;
  retrieveInvoice?: (input: {
    orderNo: string;
    actorUserId: string;
  }) => Promise<
    | { status: 'ok'; invoiceUrl: string }
    | {
        status:
          | 'not_found'
          | 'forbidden'
          | 'missing_invoice'
          | 'missing_invoice_url';
      }
  >;
};

type BillingActionQuery = {
  subscriptionNo: string;
  orderNo: string;
};

const billingPath = '/settings/billing' as const;
const cancelPath = '/settings/billing/cancel' as const;
const portalPath = '/settings/billing/retrieve' as const;
const invoicePath = '/settings/invoices/retrieve' as const;

export async function resolveSettingsBillingCancelRouteData(
  input: SettingsBillingActionRouteInput,
  deps: SettingsBillingActionRouteResolverDeps = {}
) {
  const context = await readActionContext(input, cancelPath, deps);
  if (!context) {
    return null;
  }

  const { locale, messages, query, baseData } = context;
  if (!query.subscriptionNo) {
    return serializeRouteData({
      ...baseData,
      page: buildMessagePageData(
        messages,
        locale,
        cancelPath,
        readBillingError(messages, 'invalid_subscription_no')
      ),
    });
  }

  const signedInUser = await readSignedInUser(deps);
  const baseDataWithViewer = withSignedInViewer(baseData, signedInUser);
  if (!signedInUser) {
    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        cancelPath,
        readBillingError(messages, 'no_auth')
      ),
    });
  }

  try {
    const result = await (
      deps.readCancelableSubscription ?? readMemberCancelableSubscription
    )({
      subscriptionNo: query.subscriptionNo,
      actorUserId: signedInUser.id,
    });

    if (result.status !== 'ok') {
      return serializeRouteData({
        ...baseDataWithViewer,
        page: buildMessagePageData(
          messages,
          locale,
          cancelPath,
          readCancelableSubscriptionError(messages, result.status)
        ),
      });
    }

    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildCancelPageData(messages, locale, query, result.subscription),
    });
  } catch {
    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        cancelPath,
        readBillingError(messages, 'payment_service_unavailable')
      ),
    });
  }
}

export async function resolveSettingsBillingPortalRouteData(
  input: SettingsBillingActionRouteInput,
  deps: SettingsBillingActionRouteResolverDeps = {}
) {
  const context = await readActionContext(input, portalPath, deps);
  if (!context) {
    return null;
  }

  const { locale, messages, query, baseData } = context;
  if (!query.subscriptionNo) {
    return serializeRouteData({
      ...baseData,
      page: buildMessagePageData(
        messages,
        locale,
        portalPath,
        readBillingError(messages, 'invalid_subscription_no')
      ),
    });
  }

  const signedInUser = await readSignedInUser(deps);
  const baseDataWithViewer = withSignedInViewer(baseData, signedInUser);
  if (!signedInUser) {
    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        portalPath,
        readBillingError(messages, 'no_auth')
      ),
    });
  }

  try {
    const result = await (
      deps.retrieveBillingPortal ?? retrieveMemberBillingPortalUrl
    )({
      subscriptionNo: query.subscriptionNo,
      actorUserId: signedInUser.id,
      returnUrl: buildCanonicalUrl(billingPath, locale),
    });

    if (result.status === 'ok') {
      const redirectHref = normalizeExternalRedirect(result.billingUrl);
      if (redirectHref) {
        return serializeRouteData({
          ...baseDataWithViewer,
          redirectHref,
          page: buildMessagePageData(messages, locale, portalPath, null),
        });
      }

      return serializeRouteData({
        ...baseDataWithViewer,
        page: buildMessagePageData(
          messages,
          locale,
          portalPath,
          readBillingError(messages, 'billing_url_not_found')
        ),
      });
    }

    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        portalPath,
        readBillingPortalError(messages, result.status)
      ),
    });
  } catch {
    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        portalPath,
        readBillingError(messages, 'get_billing_failed')
      ),
    });
  }
}

export async function resolveSettingsInvoiceRetrieveRouteData(
  input: SettingsBillingActionRouteInput,
  deps: SettingsBillingActionRouteResolverDeps = {}
) {
  const context = await readActionContext(input, invoicePath, deps);
  if (!context) {
    return null;
  }

  const { locale, messages, query, baseData } = context;
  if (!query.orderNo) {
    return serializeRouteData({
      ...baseData,
      page: buildMessagePageData(
        messages,
        locale,
        invoicePath,
        'invalid order no'
      ),
    });
  }

  const signedInUser = await readSignedInUser(deps);
  const baseDataWithViewer = withSignedInViewer(baseData, signedInUser);
  if (!signedInUser) {
    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        invoicePath,
        'no auth, please sign in'
      ),
    });
  }

  try {
    const result = await (deps.retrieveInvoice ?? retrieveMemberInvoiceUrl)({
      orderNo: query.orderNo,
      actorUserId: signedInUser.id,
    });

    if (result.status === 'ok') {
      const redirectHref = normalizeExternalRedirect(result.invoiceUrl);
      if (redirectHref) {
        return serializeRouteData({
          ...baseDataWithViewer,
          redirectHref,
          page: buildMessagePageData(messages, locale, invoicePath, null),
        });
      }

      return serializeRouteData({
        ...baseDataWithViewer,
        page: buildMessagePageData(
          messages,
          locale,
          invoicePath,
          'invoice url not found'
        ),
      });
    }

    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        invoicePath,
        readInvoiceError(result.status)
      ),
    });
  } catch {
    return serializeRouteData({
      ...baseDataWithViewer,
      page: buildMessagePageData(
        messages,
        locale,
        invoicePath,
        'get invoice failed'
      ),
    });
  }
}

export async function resolveSettingsBillingCancelSubmit(
  input: SettingsBillingCancelInput,
  deps: SettingsBillingActionRouteResolverDeps = {}
): Promise<SettingsBillingCancelResult> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return { status: 'error', message: 'Invalid locale', redirectTo: null };
  }

  const resolvePayment =
    deps.resolvePaymentCapability ?? resolveSitePaymentCapability;
  if (resolvePayment() === 'none') {
    return {
      status: 'error',
      message: 'Payment service unavailable',
      redirectTo: null,
    };
  }

  const messages = await loadSettingsBillingRouteMessages(locale);
  if (!messages) {
    return { status: 'error', message: 'Invalid locale', redirectTo: null };
  }

  const subscriptionNo =
    typeof input.subscriptionNo === 'string' ? input.subscriptionNo.trim() : '';
  if (!subscriptionNo) {
    return {
      status: 'error',
      message: readBillingError(messages, 'invalid_subscription_no'),
      redirectTo: null,
    };
  }

  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  const signedInUser = await readSignedInUserIdentity();
  if (!signedInUser) {
    return {
      status: 'error',
      message: readBillingError(messages, 'no_auth'),
      redirectTo: null,
    };
  }

  try {
    const result = await (deps.cancelSubscription ?? cancelMemberSubscription)({
      subscriptionNo,
      actorUserId: signedInUser.id,
    });

    if (result.status === 'ok') {
      return {
        status: 'success',
        message: 'Subscription canceled',
        redirectTo: localePath(billingPath, locale),
      };
    }

    return {
      status: 'error',
      message: readCancelSubmitError(messages, result.status),
      redirectTo: null,
    };
  } catch {
    return {
      status: 'error',
      message: readBillingError(messages, 'payment_service_unavailable'),
      redirectTo: null,
    };
  }
}

async function readActionContext(
  input: SettingsBillingActionRouteInput,
  canonicalPath: SettingsBillingActionRouteData['canonicalPath'],
  deps: SettingsBillingActionRouteResolverDeps
) {
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

  const query = parseActionQuery(input);
  const baseData = {
    locale,
    canonicalPath,
    redirectHref: null,
    head: buildSettingsBillingActionHead(messages, locale, canonicalPath),
    shell: buildSettingsShellData(messages, locale, canonicalPath),
    viewer: {
      signedIn: false,
    },
  };

  return {
    locale,
    messages,
    query,
    baseData,
  };
}

async function readSignedInUser(deps: SettingsBillingActionRouteResolverDeps) {
  const readSignedInUserIdentity =
    deps.readSignedInUserIdentity ?? readCurrentSignedInUserIdentity;
  return readSignedInUserIdentity();
}

function withSignedInViewer(
  baseData: Omit<SettingsBillingActionRouteData, 'page'>,
  signedInUser: AuthSessionUserIdentity | null
) {
  return {
    ...baseData,
    viewer: {
      signedIn: Boolean(signedInUser),
    },
  };
}

async function readCurrentSignedInUserIdentity() {
  const { getRequest } = await import('@tanstack/react-start/server');
  return getSignedInUserIdentityFromRequest(getRequest());
}

function parseActionQuery(
  input: SettingsBillingActionRouteInput
): BillingActionQuery {
  const params = getSearchValues(input.search);

  return {
    subscriptionNo:
      readQueryValue(params.subscriptionNo, input.subscription_no) ??
      readQueryValue(null, input.subscriptionNo) ??
      '',
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
      subscriptionNo: readSearchObjectValue(
        record.subscription_no ?? record.subscriptionNo
      ),
      orderNo: readSearchObjectValue(record.order_no ?? record.orderNo),
    };
  }

  return {
    subscriptionNo: null,
    orderNo: null,
  };
}

function getSearchParamsValues(params: URLSearchParams) {
  return {
    subscriptionNo: params.get('subscription_no'),
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

function buildSettingsBillingActionHead(
  messages: SettingsBillingRouteMessages,
  locale: string,
  canonicalPath: SettingsBillingActionRouteData['canonicalPath']
) {
  const billing = getObject(messages.billing);
  const settingsTitle = readString(
    getObject(messages.sidebar).title,
    'Settings'
  );
  const title =
    canonicalPath === cancelPath
      ? readString(getObject(billing.cancel).title, 'Cancel Subscription')
      : readString(getObject(billing.list).title, 'Billing');
  const description =
    canonicalPath === cancelPath
      ? readString(
          getObject(billing.cancel).description,
          'Are you sure you want to cancel your subscription?'
        )
      : title;
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
  locale: string,
  canonicalPath: SettingsBillingActionRouteData['canonicalPath']
): SettingsShellData {
  const sidebar = getObject(messages.sidebar);

  return {
    title: readString(sidebar.title, 'Settings'),
    nav: {
      items: buildSettingsShellNavItems({
        activePath: billingPath,
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

function buildCancelPageData(
  messages: SettingsBillingRouteMessages,
  locale: string,
  query: BillingActionQuery,
  subscription: CancelableSubscriptionRecord
): SettingsBillingActionRouteData['page'] {
  const cancel = getObject(getObject(messages.billing).cancel);

  return {
    kind: 'cancel',
    title: readString(cancel.title, 'Cancel Subscription'),
    description: readString(
      cancel.description,
      'Are you sure you want to cancel your subscription?'
    ),
    message: null,
    backHref: localePath(billingPath, locale),
    query,
    labels: buildActionLabels(messages),
    subscription: serializeSubscription(subscription),
  };
}

function buildMessagePageData(
  messages: SettingsBillingRouteMessages,
  locale: string,
  canonicalPath: SettingsBillingActionRouteData['canonicalPath'],
  message: string | null
): SettingsBillingActionRouteData['page'] {
  const cancel = getObject(getObject(messages.billing).cancel);
  const title =
    canonicalPath === cancelPath
      ? readString(cancel.title, 'Cancel Subscription')
      : readString(
          getObject(getObject(messages.billing).list).title,
          'Billing'
        );

  return {
    kind: 'message',
    title,
    description: '',
    message,
    backHref: localePath(billingPath, locale),
    query: {
      subscriptionNo: '',
      orderNo: '',
    },
    labels: buildActionLabels(messages),
    subscription: null,
  };
}

function buildActionLabels(messages: SettingsBillingRouteMessages) {
  const cancel = getObject(getObject(messages.billing).cancel);
  const fields = getObject(cancel.fields);
  const buttons = getObject(cancel.buttons);

  return {
    subscriptionNo: readString(fields.subscription_no, 'Subscription No'),
    subscriptionAmount: readString(
      fields.subscription_amount,
      'Subscription Amount'
    ),
    intervalCycle: readString(fields.interval_cycle, 'Interval Cycle'),
    subscriptionCreatedAt: readString(
      fields.subscription_created_at,
      'Subscription Created At'
    ),
    currentPeriod: readString(fields.current_period, 'Current Period'),
    submit: readString(buttons.confirm_cancel, 'Confirm Cancel'),
    back: 'Back to billing',
    success: 'Subscription canceled',
  };
}

function serializeSubscription(
  subscription: CancelableSubscriptionRecord
): SettingsBillingActionRouteData['page']['subscription'] {
  return {
    subscriptionNo: subscription.subscriptionNo ?? '',
    amount: formatPaymentAmountCents(
      subscription.amount,
      subscription.currency
    ),
    intervalCycle: `every ${subscription.intervalCount ?? 1} ${
      subscription.interval ?? ''
    }`.trim(),
    createdAt: formatYmd(subscription.createdAt),
    currentPeriod: `${formatYmd(subscription.currentPeriodStart)} ~ ${formatYmd(
      subscription.currentPeriodEnd
    )}`,
  };
}

function normalizeExternalRedirect(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

function readCancelableSubscriptionError(
  messages: SettingsBillingRouteMessages,
  status:
    | 'not_found'
    | 'forbidden'
    | 'missing_subscription_target'
    | 'payment_unavailable'
) {
  if (status === 'forbidden') {
    return readBillingError(messages, 'no_permission');
  }

  if (status === 'missing_subscription_target') {
    return readBillingError(messages, 'missing_payment_subscription_id');
  }

  if (status === 'payment_unavailable') {
    return readBillingError(messages, 'payment_service_unavailable');
  }

  return readBillingError(messages, 'subscription_not_found');
}

function readBillingPortalError(
  messages: SettingsBillingRouteMessages,
  status: 'not_found' | 'forbidden' | 'missing_customer' | 'missing_billing_url'
) {
  if (status === 'forbidden') {
    return readBillingError(messages, 'no_permission');
  }

  if (status === 'missing_customer') {
    return readBillingError(messages, 'missing_payment_user_id');
  }

  if (status === 'missing_billing_url') {
    return readBillingError(messages, 'billing_url_not_found');
  }

  return readBillingError(messages, 'subscription_not_found');
}

function readInvoiceError(
  status: 'not_found' | 'forbidden' | 'missing_invoice' | 'missing_invoice_url'
) {
  if (status === 'forbidden') {
    return 'no permission';
  }

  if (status === 'missing_invoice') {
    return 'order with no invoice';
  }

  if (status === 'missing_invoice_url') {
    return 'invoice url not found';
  }

  return 'order not found';
}

function readCancelSubmitError(
  messages: SettingsBillingRouteMessages,
  status:
    | 'not_found'
    | 'forbidden'
    | 'invalid_status'
    | 'missing_provider'
    | 'cancel_failed'
) {
  if (status === 'forbidden') {
    return readBillingError(messages, 'no_permission');
  }

  if (status === 'invalid_status') {
    return 'subscription is not active or trialing';
  }

  if (status === 'missing_provider') {
    return readBillingError(messages, 'payment_service_unavailable');
  }

  if (status === 'cancel_failed') {
    return 'cancel subscription failed';
  }

  return readBillingError(messages, 'subscription_not_found');
}

function readBillingError(messages: SettingsBillingRouteMessages, key: string) {
  const errors = getObject(getObject(messages.billing).errors);
  return readString(errors[key], key);
}

function serializeRouteData(data: unknown) {
  return JSON.parse(JSON.stringify(data)) as SettingsBillingActionRouteData;
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
