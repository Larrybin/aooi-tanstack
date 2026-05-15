import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export function resolveSitePricingPath({ rootDir, siteKey }) {
  return path.resolve(rootDir, 'sites', siteKey, 'pricing.json');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertNonEmptyString(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }
}

function validatePricingItem(item, index, siteKey) {
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

export function validateSitePricing(sitePricing, { siteKey }) {
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
}) {
  const sourcePath = resolveSitePricingPath({ rootDir, siteKey });
  if (!existsSync(sourcePath)) {
    if (site.capabilities?.payment && site.capabilities.payment !== 'none') {
      throw new Error(
        `site "${siteKey}" requires sites/${siteKey}/pricing.json because payment is enabled`
      );
    }

    return null;
  }

  const pricing = JSON.parse(readFileSync(sourcePath, 'utf8'));
  validateSitePricing(pricing, { siteKey });
  return pricing;
}
