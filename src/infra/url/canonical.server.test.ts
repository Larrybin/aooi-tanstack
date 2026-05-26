import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import {
  defaultLocale,
  localeHreflangs,
  locales,
  type Locale,
} from '@/config/locale';

import { buildCanonicalUrl, buildLanguageAlternates } from './canonical';

test('buildCanonicalUrl: 使用 @/site 作为唯一 canonical base', () => {
  assert.equal(buildCanonicalUrl('/pricing'), `${site.brand.appUrl}/pricing`);
  assert.equal(
    buildCanonicalUrl('/pricing', 'zh'),
    `${site.brand.appUrl}/zh/pricing`
  );
});

test('buildLanguageAlternates: 所有 alternates 共享 canonical helper', () => {
  const alternates = buildLanguageAlternates('/pricing');

  for (const locale of locales) {
    assert.equal(
      alternates?.[localeHreflangs[locale]],
      buildCanonicalUrl('/pricing', locale)
    );
  }
  assert.equal(
    alternates?.['x-default'],
    buildCanonicalUrl('/pricing', defaultLocale)
  );
});

test('buildLanguageAlternates: 只包含当前 site 支持的语言', () => {
  const alternates = buildLanguageAlternates('/pricing');
  const alternateLocales = Object.keys(alternates ?? {}).filter(
    (locale) => locale !== 'x-default'
  );

  assert.deepEqual(
    alternateLocales,
    locales.map((locale: Locale) => localeHreflangs[locale])
  );
});
