import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import { defaultLocale, localeHreflangs } from '@/config/locale';

import {
  buildCanonicalUrl,
  buildLanguageAlternates,
  getPublishedLocalesForPath,
  isPublishedLocaleForPath,
} from './canonical';

test('buildCanonicalUrl: 使用 @/site 作为唯一 canonical base', () => {
  assert.equal(buildCanonicalUrl('/pricing'), `${site.brand.appUrl}/pricing`);
  assert.equal(
    buildCanonicalUrl('/pricing', 'zh'),
    `${site.brand.appUrl}/zh/pricing`
  );
});

test('buildLanguageAlternates: 所有 alternates 共享 canonical helper', () => {
  const alternates = buildLanguageAlternates('/pricing');

  for (const locale of getPublishedLocalesForPath('/pricing')) {
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

test('buildLanguageAlternates: 只包含 approved published 语言', () => {
  const alternates = buildLanguageAlternates('/pricing');
  const alternateLocales = Object.keys(alternates ?? {}).filter(
    (locale) => locale !== 'x-default'
  );

  assert.deepEqual(
    alternateLocales,
    getPublishedLocalesForPath('/pricing').map(
      (locale) => localeHreflangs[locale]
    )
  );
});

test('isPublishedLocaleForPath: 未 approved 的目标语言不可发布', () => {
  assert.equal(isPublishedLocaleForPath('/pricing', defaultLocale), true);

  for (const locale of Object.keys(localeHreflangs)) {
    if (locale === defaultLocale) {
      continue;
    }

    assert.equal(
      isPublishedLocaleForPath('/pricing', locale),
      getPublishedLocalesForPath('/pricing').includes(locale)
    );
  }
});
