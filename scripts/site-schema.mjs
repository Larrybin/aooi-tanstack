import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localeRegistryPath = resolve(
  rootDir,
  'src',
  'config',
  'locale',
  'registry.json'
);
const localeRegistry = JSON.parse(readFileSync(localeRegistryPath, 'utf8'));
const localeCodes = new Set(localeRegistry.map((entry) => entry.code));

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertPaymentCapability(value) {
  const allowedValues = new Set(['none', 'stripe', 'creem', 'paypal']);
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new Error(
      'capabilities.payment must be one of: none, stripe, creem, paypal'
    );
  }
}

function assertAppUrl(value, label) {
  assertNonEmptyString(value, label);

  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${label} must be a valid URL (${String(error)})`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must use http/https`);
  }
}

function assertRegisteredLocale(value, label) {
  assertNonEmptyString(value, label);
  if (!localeCodes.has(value)) {
    throw new Error(`${label} must be registered in locale registry`);
  }
}

function validateSiteI18nConfig(i18n) {
  if (i18n === undefined) {
    throw new Error('site.i18n is required');
  }

  if (!i18n || typeof i18n !== 'object' || Array.isArray(i18n)) {
    throw new Error('site.i18n must be an object');
  }

  assertRegisteredLocale(i18n.defaultLocale, 'site.i18n.defaultLocale');

  if (
    !Array.isArray(i18n.supportedLocales) ||
    i18n.supportedLocales.length === 0
  ) {
    throw new Error('site.i18n.supportedLocales must be a non-empty array');
  }

  const seenLocales = new Set();
  for (const locale of i18n.supportedLocales) {
    assertRegisteredLocale(locale, 'site.i18n.supportedLocales[]');
    if (seenLocales.has(locale)) {
      throw new Error(
        `site.i18n.supportedLocales contains duplicate locale: ${locale}`
      );
    }
    seenLocales.add(locale);
  }

  if (!seenLocales.has(i18n.defaultLocale)) {
    throw new Error(
      'site.i18n.defaultLocale must be included in site.i18n.supportedLocales'
    );
  }

  if (i18n.localePrefix !== 'as-needed') {
    throw new Error('site.i18n.localePrefix must equal as-needed');
  }

  if (i18n.localeDetection !== false) {
    throw new Error('site.i18n.localeDetection must equal false');
  }

  if (
    i18n.strictPublishing !== undefined &&
    typeof i18n.strictPublishing !== 'boolean'
  ) {
    throw new Error('site.i18n.strictPublishing must be a boolean');
  }
}

export function validateSiteConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('site config must be an object');
  }

  assertNonEmptyString(config.key, 'site.key');
  assertNonEmptyString(config.domain, 'site.domain');

  if (
    !config.brand ||
    typeof config.brand !== 'object' ||
    Array.isArray(config.brand)
  ) {
    throw new Error('site.brand is required');
  }

  assertNonEmptyString(config.brand.appName, 'site.brand.appName');
  assertAppUrl(config.brand.appUrl, 'site.brand.appUrl');
  assertNonEmptyString(config.brand.supportEmail, 'site.brand.supportEmail');
  assertNonEmptyString(config.brand.logo, 'site.brand.logo');
  assertNonEmptyString(config.brand.favicon, 'site.brand.favicon');
  assertNonEmptyString(config.brand.previewImage, 'site.brand.previewImage');

  if (
    !config.capabilities ||
    typeof config.capabilities !== 'object' ||
    Array.isArray(config.capabilities)
  ) {
    throw new Error('site.capabilities is required');
  }

  assertBoolean(config.capabilities.auth, 'site.capabilities.auth');
  assertPaymentCapability(config.capabilities.payment);
  assertBoolean(config.capabilities.ai, 'site.capabilities.ai');
  assertBoolean(config.capabilities.docs, 'site.capabilities.docs');
  assertBoolean(config.capabilities.blog, 'site.capabilities.blog');
  validateSiteI18nConfig(config.i18n);

  if (config.configVersion !== 1) {
    throw new Error('site.configVersion must equal 1');
  }
}
