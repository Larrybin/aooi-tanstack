import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import type { PricingRouteData } from '@/domains/pricing/application/pricing-page';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PricingSliceView,
  resolveCheckoutFailureAction,
} from './pricing-slice-view';

test('PricingSliceView renders FAQ and testimonials content', () => {
  const data = {
    locale: 'en',
    head: {},
    pricing: {
      title: 'Pricing',
      description: 'Choose a plan',
      items: [
        {
          product_id: 'pro',
          title: 'Pro',
          interval: 'month',
          amount: 1000,
          currency: 'USD',
        },
      ],
    },
    faq: {
      id: 'pricing-faq',
      title: 'Pricing FAQ',
      items: [
        {
          question: 'Can I change plans?',
          answer: 'Yes, you can change plans later.',
        },
      ],
    },
    testimonials: {
      id: 'pricing-testimonials',
      title: 'What customers say',
      items: [
        {
          name: 'Ada',
          role: 'Founder',
          quote: 'The pricing page made the offer clear.',
        },
      ],
    },
  } satisfies PricingRouteData;

  const html = renderToStaticMarkup(<PricingSliceView data={data} />);

  assert.match(html, /Pricing FAQ/);
  assert.match(html, /Can I change plans/);
  assert.match(html, /What customers say/);
  assert.match(html, /The pricing page made the offer clear/);
});

test('PricingSliceView renders disabled paid checkout items as fallback links', () => {
  const data = {
    locale: 'en',
    head: {},
    pricing: {
      title: 'Pricing',
      items: [
        {
          product_id: 'enterprise',
          title: 'Enterprise',
          interval: 'month',
          amount: 99900,
          currency: 'USD',
          checkout_enabled: false,
          button: {
            title: 'Contact sales',
            url: '/contact',
          },
        },
      ],
    },
  } satisfies PricingRouteData;

  const html = renderToStaticMarkup(<PricingSliceView data={data} />);

  assert.match(html, /href="\/contact"/);
  assert.match(html, /Contact sales/);
  assert.doesNotMatch(html, /<button/);
});

test('PricingSliceView renders only the featured pricing group by default', () => {
  const data = {
    locale: 'en',
    head: {},
    pricing: {
      title: 'Pricing',
      groups: [
        { name: 'one-time', title: 'One-time' },
        { name: 'monthly', title: 'Monthly', is_featured: true },
      ],
      items: [
        {
          product_id: 'starter',
          title: 'Starter one-time',
          interval: 'one-time',
          amount: 4900,
          currency: 'USD',
          group: 'one-time',
        },
        {
          product_id: 'starter-monthly',
          title: 'Starter monthly',
          interval: 'month',
          amount: 1900,
          currency: 'USD',
          group: 'monthly',
        },
      ],
    },
  } satisfies PricingRouteData;

  const html = renderToStaticMarkup(<PricingSliceView data={data} />);

  assert.match(html, /Starter monthly/);
  assert.doesNotMatch(html, /Starter one-time/);
  assert.match(html, /aria-pressed="true">Monthly/);
});

test('PricingSliceView defaults zh checkout display to CNY currency', () => {
  const data = {
    locale: 'zh',
    head: {},
    pricing: {
      title: 'Pricing',
      items: [
        {
          product_id: 'pro',
          title: 'Pro',
          interval: 'month',
          amount: 1900,
          currency: 'USD',
          price: '$19',
          currencies: [
            {
              currency: 'CNY',
              amount: 12900,
              price: '¥129',
              original_price: '¥199',
            },
          ],
        },
      ],
    },
  } satisfies PricingRouteData;

  const html = renderToStaticMarkup(<PricingSliceView data={data} />);

  assert.match(html, /¥129/);
  assert.match(html, /value="CNY" selected=""/);
  assert.doesNotMatch(html, />\$19</);
});

test('resolveCheckoutFailureAction redirects signed-out checkout attempts to sign-in', () => {
  const action = resolveCheckoutFailureAction({
    status: 401,
    payload: { message: 'Unauthorized' },
    locale: 'zh',
    callbackUrl: '/zh/pricing?plan=pro#checkout',
  });

  assert.deepEqual(action, {
    type: 'redirect',
    url: '/zh/sign-in?callbackUrl=%2Fpricing%3Fplan%3Dpro%23checkout',
  });
});
