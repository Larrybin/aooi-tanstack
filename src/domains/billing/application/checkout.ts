import 'server-only';

import {
  PaymentType,
  type CheckoutInfo,
  type PaymentInterval,
  type PaymentOrder,
  type PaymentPrice,
} from '@/domains/billing/domain/payment';
import { resolveCreemPaymentProductId } from '@/domains/billing/domain/payment-config';
import {
  resolveCheckoutPricingContext,
  resolvePaymentTypeFromInterval,
  resolvePricingPaymentInterval,
  resolveSubscriptionPlanName,
} from '@/domains/billing/domain/pricing';
import {
  createOrder,
  OrderStatus,
  updateOrderByOrderNo,
  type NewOrder,
  type UpdateOrder,
} from '@/domains/billing/infra/order';
import type {
  BillingRuntimeSettings,
  PaymentRuntimeBindings,
} from '@/domains/settings/application/settings-runtime.contracts';
import { getPaymentService } from '@/infra/adapters/payment/service';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import { site } from '@/site';

import { defaultLocale, locales, type Locale } from '@/config/locale';
import { resolveRuntimeAppUrl } from '@/config/runtime-app-url';
import {
  BadRequestError,
  ServiceUnavailableError,
  UnauthorizedError,
  UnprocessableEntityError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { getSnowId, getUuid } from '@/shared/lib/hash';
import type { PricingItem } from '@/shared/types/blocks/pricing';

type LogLike = {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

export function requiresPaymentProductId(
  provider: BillingRuntimeSettings['provider']
): boolean {
  return provider === 'creem';
}

function normalizeLocaleValue(
  value: string | null | undefined
): Locale | undefined {
  const normalized = (value || '').trim();
  if (!normalized) return undefined;
  const candidate = normalized === 'zh-CN' ? 'zh' : normalized;
  return locales.includes(candidate as Locale)
    ? (candidate as Locale)
    : undefined;
}

function resolveCheckoutRuntimeAppUrl(): string {
  try {
    return resolveRuntimeAppUrl({
      NEXT_PUBLIC_APP_URL: getRuntimeEnvString('NEXT_PUBLIC_APP_URL'),
    });
  } catch (error) {
    throw new ServiceUnavailableError('invalid runtime app URL configuration', {
      error,
    });
  }
}

async function getPaymentProductIdFromProviderConfig({
  productId,
  provider,
  checkoutCurrency,
  settings,
  log,
}: {
  productId: string;
  provider: string;
  checkoutCurrency: string;
  settings: BillingRuntimeSettings;
  log: LogLike;
}): Promise<string | undefined> {
  if (provider !== 'creem' || settings.provider !== 'creem') {
    return;
  }

  try {
    const resolved = resolveCreemPaymentProductId({
      configValue: settings.creemProductIds,
      productId,
      checkoutCurrency,
    });
    if (!resolved.ok) {
      log.warn('payment: invalid creem_product_ids config', {
        error: resolved.error,
        length: resolved.configLength,
      });
      throw new UnprocessableEntityError(
        'invalid payment configuration: creem_product_ids must be a JSON object'
      );
    }

    return resolved.paymentProductId;
  } catch (e: unknown) {
    if (e instanceof UnprocessableEntityError) {
      throw e;
    }
    log.error('payment: get payment product id failed', {
      provider,
      productId,
      checkoutCurrency,
      error: e,
    });
    return;
  }
}

export function buildCallbackUrl({
  settings,
  locale,
  paymentType,
}: {
  settings: BillingRuntimeSettings;
  locale: string | null | undefined;
  paymentType: PaymentType;
}): { callbackUrl: string; callbackBaseUrl: string } {
  const appUrl = resolveCheckoutRuntimeAppUrl();
  const activeLocale =
    normalizeLocaleValue(locale) ??
    normalizeLocaleValue(settings.locale) ??
    normalizeLocaleValue(settings.defaultLocale);

  let callbackBaseUrl = appUrl;
  if (activeLocale && activeLocale !== defaultLocale) {
    callbackBaseUrl += `/${activeLocale}`;
  }

  const callbackUrl =
    paymentType === PaymentType.SUBSCRIPTION
      ? `${callbackBaseUrl}/settings/billing`
      : `${callbackBaseUrl}/settings/payments`;

  return { callbackUrl, callbackBaseUrl };
}

function buildCheckoutOrder({
  pricingItem,
  user,
  paymentType,
  paymentInterval,
  orderNo,
  callbackUrl,
  callbackBaseUrl,
  paymentProductId,
  checkoutPrice,
}: {
  pricingItem: PricingItem;
  user: { id: string; email: string; name?: string | null };
  paymentType: PaymentType;
  paymentInterval: PaymentInterval;
  orderNo: string;
  callbackUrl: string;
  callbackBaseUrl: string;
  paymentProductId: string;
  checkoutPrice: PaymentPrice;
}): PaymentOrder {
  const checkoutOrder: PaymentOrder = {
    description: pricingItem.product_name,
    customer: {
      name: user.name || undefined,
      email: user.email,
    },
    type: paymentType,
    metadata: {
      appName: site.brand.appName,
      order_no: orderNo,
      user_id: user.id,
    },
    successUrl: (() => {
      try {
        const url = new URL(callbackUrl);
        url.searchParams.set('order_no', orderNo);
        return url.toString();
      } catch {
        return callbackUrl;
      }
    })(),
    cancelUrl: `${callbackBaseUrl}/pricing`,
  };

  if (paymentProductId) {
    checkoutOrder.productId = paymentProductId;
  }

  checkoutOrder.price = checkoutPrice;

  if (paymentType === PaymentType.SUBSCRIPTION) {
    checkoutOrder.plan = {
      interval: paymentInterval,
      name: resolveSubscriptionPlanName(pricingItem),
    };
  }

  return checkoutOrder;
}

function buildPendingOrder({
  orderId,
  orderNo,
  pricingItem,
  user,
  providerName,
  pricingContext,
  paymentType,
  paymentInterval,
  paymentProductId,
  callbackUrl,
  checkoutOrder,
  currentTime,
}: {
  orderId: string;
  orderNo: string;
  pricingItem: PricingItem;
  user: { id: string; email: string };
  providerName: string;
  pricingContext: ReturnType<typeof resolveCheckoutPricingContext>;
  paymentType: PaymentType;
  paymentInterval: PaymentInterval;
  paymentProductId: string;
  callbackUrl: string;
  checkoutOrder: PaymentOrder;
  currentTime: Date;
}): NewOrder {
  return {
    id: orderId,
    orderNo,
    userId: user.id,
    userEmail: user.email,
    status: OrderStatus.PENDING,
    amount: pricingContext.checkoutAmount,
    currency: pricingContext.checkoutCurrency,
    productId: pricingItem.product_id,
    paymentType,
    paymentInterval,
    paymentProvider: providerName,
    checkoutInfo: JSON.stringify(checkoutOrder),
    createdAt: currentTime,
    productName: pricingItem.product_name,
    description: pricingItem.description,
    callbackUrl,
    creditsAmount: pricingItem.credits,
    creditsValidDays: pricingItem.valid_days,
    planName: pricingItem.plan_name || '',
    paymentProductId,
  };
}

export function buildFailedCheckoutOrderUpdate(
  checkoutOrder: PaymentOrder
): UpdateOrder {
  return {
    status: OrderStatus.FAILED,
    checkoutInfo: JSON.stringify(checkoutOrder),
  };
}

export async function createPaymentCheckoutSession({
  pricingItem,
  user,
  settings,
  bindings,
  currency,
  locale,
  log,
}: {
  pricingItem: PricingItem;
  user: { id: string; email?: string | null; name?: string | null };
  settings: BillingRuntimeSettings;
  bindings: PaymentRuntimeBindings;
  currency: string | null | undefined;
  locale: string | null | undefined;
  log: LogLike;
}): Promise<CheckoutInfo> {
  if (!user.email) {
    throw new UnauthorizedError('no auth, please sign in');
  }

  if (settings.provider === 'none' || bindings.provider === 'none') {
    throw new ServiceUnavailableError('payment provider not configured');
  }

  const paymentProviderName = settings.provider;

  const pricingContext = resolveCheckoutPricingContext({
    pricingItem,
    currency,
  });

  const paymentInterval = resolvePricingPaymentInterval(pricingItem.interval);
  const paymentType = resolvePaymentTypeFromInterval(paymentInterval);

  const orderNo = getSnowId();

  let paymentProductId = (pricingContext.paymentProductId || '').trim();
  if (!paymentProductId) {
    paymentProductId =
      (await getPaymentProductIdFromProviderConfig({
        productId: pricingItem.product_id,
        provider: paymentProviderName,
        checkoutCurrency: pricingContext.checkoutCurrency,
        settings,
        log,
      })) || '';
    paymentProductId = paymentProductId.trim();
  }

  const checkoutPrice: PaymentPrice = {
    amount: pricingContext.checkoutAmount,
    currency: pricingContext.checkoutCurrency,
  };

  if (!checkoutPrice.amount || !checkoutPrice.currency) {
    throw new BadRequestError('invalid checkout price');
  }

  if (!paymentProductId && requiresPaymentProductId(paymentProviderName)) {
    throw new BadRequestError('payment product id is not configured');
  }

  const { callbackUrl, callbackBaseUrl } = buildCallbackUrl({
    settings,
    locale,
    paymentType,
  });

  const checkoutOrder = buildCheckoutOrder({
    pricingItem,
    user: { id: user.id, email: user.email, name: user.name },
    paymentType,
    paymentInterval,
    orderNo,
    callbackUrl,
    callbackBaseUrl,
    paymentProductId,
    checkoutPrice,
  });

  const currentTime = new Date();
  const orderId = getUuid();

  const order: NewOrder = buildPendingOrder({
    orderId,
    orderNo,
    pricingItem,
    user: { id: user.id, email: user.email },
    providerName: paymentProviderName,
    pricingContext,
    paymentType,
    paymentInterval,
    paymentProductId,
    callbackUrl,
    checkoutOrder,
    currentTime,
  });

  const paymentService = await getPaymentService({
    settings,
    bindings,
  });

  await createOrder(order);

  try {
    const result = await paymentService.createPayment({
      order: checkoutOrder,
    });

    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.CREATED,
      checkoutInfo: JSON.stringify(result.checkoutParams),
      checkoutResult: JSON.stringify(result.checkoutResult),
      checkoutUrl: result.checkoutInfo.checkoutUrl,
      paymentSessionId: result.checkoutInfo.sessionId,
      paymentProvider: result.provider,
    });

    return result.checkoutInfo;
  } catch (e: unknown) {
    await updateOrderByOrderNo(
      orderNo,
      buildFailedCheckoutOrderUpdate(checkoutOrder)
    );

    log.error('payment: checkout failed', {
      orderNo,
      paymentProviderName,
      paymentProvider: paymentProviderName,
      productId: pricingItem.product_id,
      currency: pricingContext.checkoutCurrency,
      error: e,
    });

    throw new UpstreamError(502, 'checkout failed');
  }
}
