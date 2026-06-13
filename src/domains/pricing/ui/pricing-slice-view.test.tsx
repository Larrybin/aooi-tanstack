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
