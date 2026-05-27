import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import type { SitePricing } from '@/shared/types/blocks/pricing';

import {
  canUseLocalizedPricingMessages,
  resolvePricingPageContent,
} from './pricing-content';

type LocalizedLandingMessages = Pick<SitePricing, 'faq' | 'testimonials'>;

async function readJson<T>(relativePath: string): Promise<T> {
  const source = await readFile(path.resolve(process.cwd(), relativePath), {
    encoding: 'utf8',
  });
  return JSON.parse(source) as T;
}

test('resolvePricingPageContent uses localized pricing when product ids match', async () => {
  const sitePricing = await readJson<SitePricing>(
    'sites/dev-local/pricing.json'
  );
  const localizedPricingMessages = await readJson<SitePricing>(
    'src/config/locale/messages/zh/pricing.json'
  );
  const localizedLandingMessages = await readJson<LocalizedLandingMessages>(
    'src/config/locale/messages/zh/landing.json'
  );

  const resolved = resolvePricingPageContent({
    sitePricing,
    localizedPricingMessages,
    localizedLandingMessages,
  });

  assert.equal(
    canUseLocalizedPricingMessages({
      sitePricing,
      localizedPricing: localizedPricingMessages.pricing,
    }),
    true
  );
  assert.equal(resolved.metadata?.title, '价格');
  assert.equal(resolved.pricing.title, '价格');
  assert.equal(resolved.pricing.items?.[0]?.title, '入门版');
  assert.equal(resolved.faq, localizedLandingMessages.faq);
  assert.equal(resolved.testimonials, localizedLandingMessages.testimonials);
});

test('resolvePricingPageContent keeps site pricing when product ids differ', async () => {
  const sitePricing = await readJson<SitePricing>(
    'sites/ai-remover/pricing.json'
  );
  const localizedPricingMessages = await readJson<SitePricing>(
    'src/config/locale/messages/zh/pricing.json'
  );
  const localizedLandingMessages = await readJson<LocalizedLandingMessages>(
    'src/config/locale/messages/zh/landing.json'
  );

  const resolved = resolvePricingPageContent({
    sitePricing,
    localizedPricingMessages,
    localizedLandingMessages,
  });

  assert.equal(
    canUseLocalizedPricingMessages({
      sitePricing,
      localizedPricing: localizedPricingMessages.pricing,
    }),
    false
  );
  assert.equal(resolved.metadata?.title, sitePricing.metadata?.title);
  assert.equal(resolved.pricing.title, 'AI Remover Pricing');
  assert.equal(resolved.pricing.items?.[0]?.product_id, 'free');
  assert.equal(resolved.faq, sitePricing.faq);
});

test('resolvePricingPageContent prefers localized site pricing when product ids match', async () => {
  const sitePricing = await readJson<SitePricing>(
    'sites/ai-remover/pricing.json'
  );
  const siteLocalePricing = await readJson<SitePricing>(
    'sites/ai-remover/pricing.zh.json'
  );
  const localizedPricingMessages = await readJson<SitePricing>(
    'src/config/locale/messages/zh/pricing.json'
  );
  const localizedLandingMessages = await readJson<LocalizedLandingMessages>(
    'src/config/locale/messages/zh/landing.json'
  );

  const resolved = resolvePricingPageContent({
    sitePricing,
    siteLocalePricing,
    localizedPricingMessages,
    localizedLandingMessages,
  });

  assert.equal(
    resolved.metadata?.title,
    'AI Remover 价格 - 免费、Pro 与 Studio 套餐'
  );
  assert.equal(resolved.pricing.title, 'AI Remover 价格');
  assert.equal(resolved.pricing.items?.[0]?.product_id, 'free');
  assert.equal(resolved.pricing.items?.[0]?.title, '免费');
  assert.equal(resolved.pricing.items?.[0]?.button?.url, '/zh');
});

test('ai remover localized free pricing CTA stays on the current locale', async () => {
  const zhPricing = await readJson<SitePricing>(
    'sites/ai-remover/pricing.zh.json'
  );
  const jaPricing = await readJson<SitePricing>(
    'sites/ai-remover/pricing.ja.json'
  );

  assert.equal(zhPricing.pricing.items?.[0]?.button?.url, '/zh');
  assert.equal(jaPricing.pricing.items?.[0]?.button?.url, '/ja');
});
