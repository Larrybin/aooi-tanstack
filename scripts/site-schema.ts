import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PRODUCT_MODULE_IDS,
  SITE_MODULE_IDS,
} from '../src/config/product-modules/registry.ts';
import type { SiteModuleId } from '../src/config/product-modules/types.ts';

export type SitePaymentProvider = 'none' | 'stripe' | 'creem' | 'paypal';

export type SiteConfig = {
  key: string;
  domain: string;
  brand: {
    appName: string;
    appUrl: string;
    supportEmail: string;
    logo: string;
    favicon: string;
    previewImage: string;
  };
  capabilities: {
    enabledModules: SiteModuleId[];
    paymentProvider: SitePaymentProvider;
  };
  i18n: {
    defaultLocale: string;
    supportedLocales: string[];
    localePrefix: 'as-needed';
    localeDetection: false;
    strictPublishing?: boolean;
  };
  configVersion: 2;
};

type JsonObject = Record<string, unknown>;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localeRegistryPath = resolve(
  rootDir,
  'src',
  'config',
  'locale',
  'registry.json'
);

function isPlainObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertPlainObject(
  value: unknown,
  label: string
): asserts value is JsonObject {
  if (!isPlainObject(value)) {
    throw new Error(`${label} must be an object`);
  }
}

const localeRegistry: unknown = JSON.parse(
  readFileSync(localeRegistryPath, 'utf8')
);
const localeCodes = new Set(
  Array.isArray(localeRegistry)
    ? localeRegistry.flatMap((entry) => {
        if (!isPlainObject(entry) || typeof entry.code !== 'string') return [];
        return [entry.code];
      })
    : []
);

function assertNonEmptyString(
  value: unknown,
  label: string
): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function assertPaymentCapability(
  value: unknown
): asserts value is SitePaymentProvider {
  const allowedValues: ReadonlySet<string> = new Set([
    'none',
    'stripe',
    'creem',
    'paypal',
  ]);
  if (typeof value !== 'string' || !allowedValues.has(value)) {
    throw new Error(
      'capabilities.paymentProvider must be one of: none, stripe, creem, paypal'
    );
  }
}

function validateCapabilities(
  capabilities: unknown
): asserts capabilities is SiteConfig['capabilities'] {
  assertPlainObject(capabilities, 'site.capabilities');

  if (!Array.isArray(capabilities.enabledModules)) {
    throw new Error('site.capabilities.enabledModules must be an array');
  }

  const allowedModules: ReadonlySet<string> = new Set(SITE_MODULE_IDS);
  const platformModules: ReadonlySet<string> = new Set(PRODUCT_MODULE_IDS);
  const seenModules = new Set<SiteModuleId>();
  for (const moduleId of capabilities.enabledModules) {
    if (typeof moduleId !== 'string' || !allowedModules.has(moduleId)) {
      if (typeof moduleId === 'string' && platformModules.has(moduleId)) {
        throw new Error(
          `site.capabilities.enabledModules cannot configure platform module: ${moduleId}`
        );
      }
      throw new Error(
        `site.capabilities.enabledModules contains unknown module: ${String(moduleId)}`
      );
    }
    const siteModuleId = moduleId as SiteModuleId;
    if (seenModules.has(siteModuleId)) {
      throw new Error(
        `site.capabilities.enabledModules contains duplicate module: ${moduleId}`
      );
    }
    seenModules.add(siteModuleId);
  }

  assertPaymentCapability(capabilities.paymentProvider);
  const hasBilling = seenModules.has('billing');
  const hasPaymentProvider = capabilities.paymentProvider !== 'none';
  if (hasBilling !== hasPaymentProvider) {
    throw new Error(
      'site capabilities require billing and a non-none paymentProvider together'
    );
  }
  if (seenModules.has('admin_settings') && !seenModules.has('auth')) {
    throw new Error(
      'site capabilities require auth when admin_settings is enabled'
    );
  }
}

function assertAppUrl(value: unknown, label: string): asserts value is string {
  assertNonEmptyString(value, label);

  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${label} must be a valid URL (${String(error)})`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must use http/https`);
  }
}

function assertRegisteredLocale(
  value: unknown,
  label: string
): asserts value is string {
  assertNonEmptyString(value, label);
  if (!localeCodes.has(value)) {
    throw new Error(`${label} must be registered in locale registry`);
  }
}

function validateSiteI18nConfig(
  i18n: unknown
): asserts i18n is SiteConfig['i18n'] {
  if (i18n === undefined) {
    throw new Error('site.i18n is required');
  }
  assertPlainObject(i18n, 'site.i18n');

  assertRegisteredLocale(i18n.defaultLocale, 'site.i18n.defaultLocale');

  if (
    !Array.isArray(i18n.supportedLocales) ||
    i18n.supportedLocales.length === 0
  ) {
    throw new Error('site.i18n.supportedLocales must be a non-empty array');
  }

  const seenLocales = new Set<string>();
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

export function validateSiteConfig(
  config: unknown
): asserts config is SiteConfig {
  assertPlainObject(config, 'site config');

  assertNonEmptyString(config.key, 'site.key');
  assertNonEmptyString(config.domain, 'site.domain');
  assertPlainObject(config.brand, 'site.brand');

  assertNonEmptyString(config.brand.appName, 'site.brand.appName');
  assertAppUrl(config.brand.appUrl, 'site.brand.appUrl');
  assertNonEmptyString(config.brand.supportEmail, 'site.brand.supportEmail');
  assertNonEmptyString(config.brand.logo, 'site.brand.logo');
  assertNonEmptyString(config.brand.favicon, 'site.brand.favicon');
  assertNonEmptyString(config.brand.previewImage, 'site.brand.previewImage');

  validateCapabilities(config.capabilities);
  validateSiteI18nConfig(config.i18n);

  if (config.configVersion !== 2) {
    throw new Error('site.configVersion must equal 2');
  }
}
