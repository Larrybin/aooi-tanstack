import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { SiteConfig } from '../site-schema.ts';

type JsonObject = Record<string, unknown>;

export type SitePricingItem = JsonObject & {
  product_id: string;
  interval: string;
  amount: number;
  currency?: string;
  checkout_enabled?: boolean;
};

export type SitePricing = JsonObject & {
  pricing: JsonObject & { items: SitePricingItem[] };
};

type SitePricingPathOptions = {
  rootDir: string;
  siteKey: string;
};

type SiteLocalizedPricingPathOptions = SitePricingPathOptions & {
  locale: string;
};

type SitePricingReadOptions = {
  rootDir?: string;
  site: SiteConfig;
  siteKey?: string;
};

export function resolveSitePricingPath({
  rootDir,
  siteKey,
}: SitePricingPathOptions): string {
  return path.resolve(rootDir, 'sites', siteKey, 'pricing.json');
}

export function resolveSiteLocalizedPricingPath({
  rootDir,
  siteKey,
  locale,
}: SiteLocalizedPricingPathOptions): string {
  return path.resolve(rootDir, 'sites', siteKey, `pricing.${locale}.json`);
}

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertNonEmptyString(
  value: unknown,
  message: string
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }
}

function validatePricingItem(
  item: unknown,
  index: number,
  siteKey: string
): asserts item is SitePricingItem {
  if (!isPlainObject(item)) {
    throw new Error(
      `site "${siteKey}" pricing item ${index} must be a JSON object`
    );
  }

  assertNonEmptyString(
    item.product_id,
    `site "${siteKey}" pricing item ${index} is missing product_id`
  );
  assertNonEmptyString(
    item.interval,
    `site "${siteKey}" pricing item "${item.product_id}" is missing interval`
  );

  if (typeof item.amount !== 'number' || !Number.isFinite(item.amount)) {
    throw new Error(
      `site "${siteKey}" pricing item "${item.product_id}" is missing numeric amount`
    );
  }

  if (item.amount < 0) {
    throw new Error(
      `site "${siteKey}" pricing item "${item.product_id}" amount must not be negative`
    );
  }

  if (item.amount === 0) {
    if (item.checkout_enabled !== false) {
      throw new Error(
        `site "${siteKey}" free pricing item "${item.product_id}" must set checkout_enabled to false`
      );
    }
    return;
  }

  assertNonEmptyString(
    item.currency,
    `site "${siteKey}" pricing item "${item.product_id}" is missing currency`
  );
}

export function validateSitePricing(
  sitePricing: unknown,
  { siteKey }: { siteKey: string }
): asserts sitePricing is SitePricing {
  if (!isPlainObject(sitePricing)) {
    throw new Error(`site "${siteKey}" pricing.json must be a JSON object`);
  }

  if (!isPlainObject(sitePricing.pricing)) {
    throw new Error(`site "${siteKey}" pricing.json must include pricing`);
  }

  if (!Array.isArray(sitePricing.pricing.items)) {
    throw new Error(
      `site "${siteKey}" pricing.json must include pricing.items`
    );
  }

  if (sitePricing.pricing.items.length === 0) {
    throw new Error(
      `site "${siteKey}" pricing.json pricing.items must not be empty`
    );
  }

  sitePricing.pricing.items.forEach((item, index) =>
    validatePricingItem(item, index, siteKey)
  );
}

export function readCurrentSitePricing({
  rootDir = process.cwd(),
  site,
  siteKey = site.key,
}: SitePricingReadOptions): SitePricing | null {
  const sourcePath = resolveSitePricingPath({ rootDir, siteKey });
  if (!existsSync(sourcePath)) {
    if (site.capabilities.paymentProvider !== 'none') {
      throw new Error(
        `site "${siteKey}" requires sites/${siteKey}/pricing.json because payment is enabled`
      );
    }

    return null;
  }

  const pricing: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'));
  validateSitePricing(pricing, { siteKey });
  return pricing;
}

export function readCurrentSiteLocalizedPricing({
  rootDir = process.cwd(),
  site,
  siteKey = site.key,
}: SitePricingReadOptions): Record<string, SitePricing> {
  const localizedPricing: Record<string, SitePricing> = {};

  for (const locale of site.i18n.supportedLocales) {
    if (locale === site.i18n.defaultLocale) continue;

    const sourcePath = resolveSiteLocalizedPricingPath({
      rootDir,
      siteKey,
      locale,
    });
    if (!existsSync(sourcePath)) continue;

    const pricing: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'));
    validateSitePricing(pricing, { siteKey });
    localizedPricing[locale] = pricing;
  }

  return localizedPricing;
}
