import { useState } from 'react';
import type { PricingRouteData } from '@/domains/pricing/application/pricing-page';

import { defaultLocale } from '@/config/locale';
import { withCallbackUrl } from '@/shared/lib/callback-url';
import { localizeCallbackUrl } from '@/shared/lib/localize-callback-url';

type PricingItem = NonNullable<PricingRouteData['pricing']['items']>[number];
type PricingGroup = NonNullable<PricingRouteData['pricing']['groups']>[number];
type PricingCurrency = NonNullable<PricingItem['currencies']>[number];

type CheckoutFailureAction =
  | {
      type: 'redirect';
      url: string;
    }
  | {
      type: 'error';
      message: string;
    };

function resolveCheckoutUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const envelope = data as { data?: unknown };
  const payload =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as Record<string, unknown>)
      : (data as Record<string, unknown>);

  for (const key of ['url', 'checkout_url', 'checkoutUrl', 'paymentUrl']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

function resolveErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

function isCheckoutEnabled(item: PricingItem) {
  return Boolean(
    item.checkout_enabled !== false &&
    item.product_id &&
    item.amount &&
    item.amount > 0
  );
}

function getDefaultPricingGroup(groups: readonly PricingGroup[] = []) {
  return groups.find((group) => group.is_featured)?.name ?? groups[0]?.name;
}

function getPricingItemCurrencies(item: PricingItem): PricingCurrency[] {
  const defaultCurrency = {
    currency: item.currency,
    amount: item.amount,
    price: item.price || '',
    original_price: item.original_price || '',
    payment_product_id: item.payment_product_id,
  } satisfies PricingCurrency;

  return item.currencies?.length
    ? [defaultCurrency, ...item.currencies]
    : [defaultCurrency];
}

function getInitialPricingCurrency(item: PricingItem, locale: string) {
  const currencies = getPricingItemCurrencies(item);
  if (locale !== 'zh') {
    return item.currency;
  }

  return (
    currencies.find((currency) => currency.currency.toLowerCase() === 'cny')
      ?.currency ?? item.currency
  );
}

function applyPricingCurrency(
  item: PricingItem,
  selectedCurrency: string
): PricingItem {
  const currency = getPricingItemCurrencies(item).find(
    (entry) => entry.currency.toLowerCase() === selectedCurrency.toLowerCase()
  );

  if (!currency) {
    return item;
  }

  return {
    ...item,
    currency: currency.currency,
    amount: currency.amount,
    price: currency.price,
    original_price: currency.original_price,
    payment_product_id: currency.payment_product_id || item.payment_product_id,
  };
}

function getPricingCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return '/pricing';
  }

  return (
    `${window.location.pathname}${window.location.search}${window.location.hash}` ||
    '/pricing'
  );
}

function buildPricingSignInUrl({
  callbackUrl,
  locale,
}: {
  callbackUrl: string;
  locale: string;
}) {
  return localizeCallbackUrl({
    callbackUrl: withCallbackUrl('/sign-in', callbackUrl),
    locale,
    defaultLocale,
  });
}

export function resolveCheckoutFailureAction({
  status,
  payload,
  locale,
  callbackUrl,
}: {
  status: number;
  payload: unknown;
  locale: string;
  callbackUrl: string;
}): CheckoutFailureAction {
  if (status === 401) {
    return {
      type: 'redirect',
      url: buildPricingSignInUrl({ callbackUrl, locale }),
    };
  }

  return {
    type: 'error',
    message: resolveErrorMessage(payload) || `Checkout failed with ${status}`,
  };
}

function PricingCard({
  item,
  locale,
  selectedCurrency,
  onCurrencyChange,
}: {
  item: PricingItem;
  locale: string;
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
}) {
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const displayedItem = applyPricingCurrency(item, selectedCurrency);
  const currencies = getPricingItemCurrencies(item);

  async function startCheckout() {
    if (!displayedItem.product_id) return;

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: displayedItem.product_id,
          currency: displayedItem.currency,
          locale,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const action = resolveCheckoutFailureAction({
          status: response.status,
          payload,
          locale,
          callbackUrl: getPricingCallbackUrl(),
        });

        if (action.type === 'redirect') {
          window.location.assign(action.url);
          return;
        }

        throw new Error(action.message);
      }

      const checkoutUrl = resolveCheckoutUrl(payload);
      if (!checkoutUrl) {
        throw new Error('Checkout response did not include a redirect URL.');
      }

      window.location.assign(checkoutUrl);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout failed.'
      );
      setStatus('idle');
    }
  }

  const enabled = isCheckoutEnabled(displayedItem);

  return (
    <article
      className={`pricing-card ${displayedItem.is_featured ? 'featured' : ''}`}
    >
      <div>
        <h2>{displayedItem.title}</h2>
        {displayedItem.description && (
          <p className="pricing-description">{displayedItem.description}</p>
        )}
      </div>
      <div className="pricing-price">
        <span>
          {displayedItem.price ||
            `${displayedItem.amount} ${displayedItem.currency || ''}`}
        </span>
        {displayedItem.original_price && (
          <del>{displayedItem.original_price}</del>
        )}
      </div>
      {currencies.length > 1 ? (
        <label>
          <span>Currency</span>
          <select
            value={selectedCurrency}
            onChange={(event) => onCurrencyChange(event.currentTarget.value)}
          >
            {currencies.map((currency) => (
              <option key={currency.currency} value={currency.currency}>
                {currency.currency.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {displayedItem.features?.length ? (
        <ul>
          {displayedItem.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      {displayedItem.tip && <p className="pricing-tip">{displayedItem.tip}</p>}
      {enabled ? (
        <button onClick={startCheckout} disabled={status === 'loading'}>
          {status === 'loading'
            ? 'Opening checkout...'
            : displayedItem.button?.title || 'Checkout'}
        </button>
      ) : (
        <a className="pricing-link" href={displayedItem.button?.url || '#'}>
          {displayedItem.button?.title || 'Get started'}
        </a>
      )}
      {error && <p className="pricing-error">{error}</p>}
    </article>
  );
}

export function PricingSliceView({ data }: { data: PricingRouteData }) {
  const items = data.pricing.items ?? [];
  const groups = data.pricing.groups ?? [];
  const [selectedGroup, setSelectedGroup] = useState(() =>
    getDefaultPricingGroup(groups)
  );
  const [selectedCurrencies, setSelectedCurrencies] = useState<
    Record<string, string>
  >({});
  const visibleItems =
    selectedGroup && groups.length
      ? items.filter((item) => !item.group || item.group === selectedGroup)
      : items;

  return (
    <main className="pricing-shell">
      <section className="pricing-hero">
        <span className="pricing-eyebrow">
          {data.pricing.name || 'Pricing'}
        </span>
        <h1>{data.pricing.title}</h1>
        {data.pricing.description && <p>{data.pricing.description}</p>}
      </section>
      {groups.length ? (
        <section className="pricing-groups" aria-label="Pricing groups">
          {groups.map((group) => (
            <button
              key={group.name || group.title}
              type="button"
              aria-pressed={selectedGroup === group.name}
              onClick={() => setSelectedGroup(group.name)}
            >
              {group.title || group.name}
              {group.label ? <span>{group.label}</span> : null}
            </button>
          ))}
        </section>
      ) : null}
      <section className="pricing-grid" aria-label="Pricing plans">
        {visibleItems.map((item) => (
          <PricingCard
            key={item.product_id || item.title}
            item={item}
            locale={data.locale}
            selectedCurrency={
              selectedCurrencies[item.product_id] ??
              getInitialPricingCurrency(item, data.locale)
            }
            onCurrencyChange={(currency) =>
              setSelectedCurrencies((current) => ({
                ...current,
                [item.product_id]: currency,
              }))
            }
          />
        ))}
      </section>
      {data.faq ? (
        <section id={data.faq.id} className="pricing-faq">
          <div className="pricing-section-heading">
            <h2>{data.faq.title}</h2>
            {data.faq.description ? <p>{data.faq.description}</p> : null}
          </div>
          {data.faq.items?.length ? (
            <div className="pricing-faq-list">
              {data.faq.items.map((item) => (
                <article key={item.question} className="pricing-faq-item">
                  <h3>{item.question}</h3>
                  {item.answer ? <p>{item.answer}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
          {data.faq.tip ? <p className="pricing-tip">{data.faq.tip}</p> : null}
        </section>
      ) : null}
      {data.testimonials ? (
        <section id={data.testimonials.id} className="pricing-testimonials">
          <div className="pricing-section-heading">
            <h2>{data.testimonials.title}</h2>
            {data.testimonials.description ? (
              <p>{data.testimonials.description}</p>
            ) : null}
          </div>
          {data.testimonials.items?.length ? (
            <div className="pricing-testimonial-list">
              {data.testimonials.items.map((item) => (
                <article key={item.name} className="pricing-testimonial">
                  {item.quote ? <p>{item.quote}</p> : null}
                  <div>
                    <div>
                      {item.name ? <strong>{item.name}</strong> : null}
                      {item.role ? <span>{item.role}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
