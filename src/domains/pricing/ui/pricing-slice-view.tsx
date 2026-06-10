import { useState } from 'react';
import type { PricingRouteData } from '@/domains/pricing/application/pricing-page';

type PricingItem = NonNullable<PricingRouteData['pricing']['items']>[number];

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
  return Boolean(item.product_id && item.amount && item.amount > 0);
}

function PricingCard({ item, locale }: { item: PricingItem; locale: string }) {
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    if (!item.product_id) return;

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/payment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: item.product_id,
          currency: item.currency,
          locale,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          resolveErrorMessage(payload) ||
            `Checkout failed with ${response.status}`
        );
      }

      const checkoutUrl = resolveCheckoutUrl(payload);
      if (!checkoutUrl) {
        throw new Error('Checkout response did not include a redirect URL.');
      }

      window.location.href = checkoutUrl;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'Checkout failed.'
      );
      setStatus('idle');
    }
  }

  const enabled = isCheckoutEnabled(item);

  return (
    <article className={`pricing-card ${item.is_featured ? 'featured' : ''}`}>
      <div>
        <h2>{item.title}</h2>
        {item.description && (
          <p className="pricing-description">{item.description}</p>
        )}
      </div>
      <div className="pricing-price">
        <span>{item.price || `${item.amount} ${item.currency || ''}`}</span>
        {item.original_price && <del>{item.original_price}</del>}
      </div>
      {item.features?.length ? (
        <ul>
          {item.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
      {item.tip && <p className="pricing-tip">{item.tip}</p>}
      {enabled ? (
        <button onClick={startCheckout} disabled={status === 'loading'}>
          {status === 'loading'
            ? 'Opening checkout...'
            : item.button?.title || 'Checkout'}
        </button>
      ) : (
        <a className="pricing-link" href={item.button?.url || '#'}>
          {item.button?.title || 'Get started'}
        </a>
      )}
      {error && <p className="pricing-error">{error}</p>}
    </article>
  );
}

export function PricingSliceView({ data }: { data: PricingRouteData }) {
  const items = data.pricing.items ?? [];
  return (
    <main className="pricing-shell">
      <section className="pricing-hero">
        <span className="pricing-eyebrow">
          {data.pricing.name || 'Pricing'}
        </span>
        <h1>{data.pricing.title}</h1>
        {data.pricing.description && <p>{data.pricing.description}</p>}
      </section>
      <section className="pricing-grid" aria-label="Pricing plans">
        {items.map((item) => (
          <PricingCard
            key={item.product_id || item.title}
            item={item}
            locale={data.locale}
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
