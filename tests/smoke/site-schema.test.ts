import assert from 'node:assert/strict';
import test from 'node:test';

import { validateSiteConfig } from '../../scripts/site-schema.mjs';

function buildSiteConfig(overrides: Record<string, unknown> = {}) {
  return {
    key: 'test-site',
    domain: 'example.com',
    brand: {
      appName: 'Test Site',
      appUrl: 'https://example.com',
      supportEmail: 'support@example.com',
      logo: '/logo.png',
      favicon: '/favicon.ico',
      previewImage: '/logo.png',
    },
    capabilities: {
      auth: true,
      payment: 'none',
      ai: false,
      docs: true,
      blog: true,
    },
    configVersion: 1,
    ...overrides,
  };
}

test('site schema accepts registered site-level i18n config', () => {
  assert.doesNotThrow(() =>
    validateSiteConfig(
      buildSiteConfig({
        i18n: {
          defaultLocale: 'en',
          supportedLocales: ['en', 'zh', 'ja'],
          localePrefix: 'as-needed',
          localeDetection: false,
        },
      })
    )
  );
});

test('site schema accepts explicit i18n strict publishing enforcement', () => {
  assert.doesNotThrow(() =>
    validateSiteConfig(
      buildSiteConfig({
        i18n: {
          defaultLocale: 'en',
          supportedLocales: ['en', 'zh', 'ja'],
          localePrefix: 'as-needed',
          localeDetection: false,
          strictPublishing: true,
        },
      })
    )
  );
});

test('site schema requires site-level i18n config', () => {
  assert.throws(
    () => validateSiteConfig(buildSiteConfig()),
    /site\.i18n is required/
  );
});

test('site schema rejects locales outside the registry', () => {
  assert.throws(
    () =>
      validateSiteConfig(
        buildSiteConfig({
          i18n: {
            defaultLocale: 'en',
            supportedLocales: ['en', 'does-not-exist'],
            localePrefix: 'as-needed',
            localeDetection: false,
          },
        })
      ),
    /registered in locale registry/
  );
});

test('site schema requires defaultLocale in supportedLocales', () => {
  assert.throws(
    () =>
      validateSiteConfig(
        buildSiteConfig({
          i18n: {
            defaultLocale: 'ja',
            supportedLocales: ['en', 'zh'],
            localePrefix: 'as-needed',
            localeDetection: false,
          },
        })
      ),
    /defaultLocale must be included/
  );
});

test('site schema rejects duplicate supported locales', () => {
  assert.throws(
    () =>
      validateSiteConfig(
        buildSiteConfig({
          i18n: {
            defaultLocale: 'en',
            supportedLocales: ['en', 'zh', 'zh'],
            localePrefix: 'as-needed',
            localeDetection: false,
          },
        })
      ),
    /duplicate locale: zh/
  );
});

test('site schema requires fixed routing policy for v1', () => {
  assert.throws(
    () =>
      validateSiteConfig(
        buildSiteConfig({
          i18n: {
            defaultLocale: 'en',
            supportedLocales: ['en', 'zh'],
            localePrefix: 'always',
            localeDetection: false,
          },
        })
      ),
    /localePrefix must equal as-needed/
  );

  assert.throws(
    () =>
      validateSiteConfig(
        buildSiteConfig({
          i18n: {
            defaultLocale: 'en',
            supportedLocales: ['en', 'zh'],
            localePrefix: 'as-needed',
            localeDetection: true,
          },
        })
      ),
    /localeDetection must equal false/
  );
});

test('site schema rejects non-boolean strict publishing enforcement', () => {
  assert.throws(
    () =>
      validateSiteConfig(
        buildSiteConfig({
          i18n: {
            defaultLocale: 'en',
            supportedLocales: ['en', 'zh'],
            localePrefix: 'as-needed',
            localeDetection: false,
            strictPublishing: 'yes',
          },
        })
      ),
    /strictPublishing must be a boolean/
  );
});
