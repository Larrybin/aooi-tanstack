import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSiteI18nManifest,
  parseSiteI18nPages,
  readSiteI18nPackage,
  validateSiteI18nPackage,
} from '../../scripts/lib/site-i18n-pages.mjs';

const validPages = parseSiteI18nPages({
  pages: [
    {
      pageId: 'home',
      path: '/',
      type: 'seo',
      indexable: true,
      required: true,
      source: {
        kind: 'app-route',
        path: 'src/app/[locale]/(landing)/page.tsx',
      },
      hashScope: 'seo',
    },
  ],
});

const validSite = {
  i18n: {
    defaultLocale: 'en',
    supportedLocales: ['en', 'zh'],
  },
};

test('site i18n package reads page registry and manifest for configured sites', () => {
  const mamamiya = readSiteI18nPackage({ siteKey: 'mamamiya' });
  assert.ok(mamamiya.pages.pages.some((page) => page.pageId === 'home'));
  assert.deepEqual(Object.keys(mamamiya.manifest.locales).sort(), ['ja', 'zh']);

  const aiRemover = readSiteI18nPackage({ siteKey: 'ai-remover' });
  assert.deepEqual(Object.keys(aiRemover.manifest.locales).sort(), [
    'ja',
    'zh',
  ]);
});

test('site i18n pages schema rejects duplicate page ids', () => {
  assert.throws(
    () =>
      parseSiteI18nPages({
        pages: [validPages.pages[0], validPages.pages[0]],
      }),
    /duplicate pageId/
  );
});

test('site i18n pages schema rejects unsafe source paths', () => {
  assert.throws(
    () =>
      parseSiteI18nPages({
        pages: [
          {
            ...validPages.pages[0],
            source: {
              kind: 'site-content',
              path: '../content/pages/home.mdx',
            },
          },
        ],
      }),
    /path must not contain \.\./
  );
});

test('site i18n manifest excludes the default locale', () => {
  assert.throws(
    () =>
      validateSiteI18nPackage({
        pages: validPages,
        manifest: parseSiteI18nManifest({
          locales: {
            en: {},
            zh: {},
          },
        }),
        site: validSite,
      }),
    /must not include default locale "en"/
  );
});

test('site i18n manifest requires every non-default site locale', () => {
  assert.throws(
    () =>
      validateSiteI18nPackage({
        pages: validPages,
        manifest: parseSiteI18nManifest({
          locales: {},
        }),
        site: validSite,
      }),
    /missing locale "zh"/
  );
});

test('site i18n manifest entries must match registry pages', () => {
  assert.throws(
    () =>
      validateSiteI18nPackage({
        pages: validPages,
        manifest: parseSiteI18nManifest({
          locales: {
            zh: {
              home: {
                path: '/not-home',
                status: 'approved',
                sourceHash: 'source',
                targetHash: 'target',
              },
            },
          },
        }),
        site: validSite,
      }),
    /path must equal "\/"/
  );
});
