import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkLocalizedText,
  findForbiddenTerms,
} from '../../scripts/lib/site-i18n-content-gates.ts';
import {
  parseSiteI18nGlossary,
  readMergedI18nGlossary,
} from '../../scripts/lib/site-i18n-glossary.ts';

const glossary = {
  preserve: ['AI', 'API', 'Mamamiya'],
  terms: {
    credits: {
      zh: '积分',
      ja: 'クレジット',
    },
  },
  forbidden: {
    allLocales: ['100% perfect'],
    zh: ['永久免费'],
  },
};

test('site i18n glossary merges global and site preserve terms', () => {
  const mergedGlossary = readMergedI18nGlossary({ siteKey: 'mamamiya' });

  assert.ok(mergedGlossary.preserve.includes('AI'));
  assert.ok(mergedGlossary.preserve.includes('Mamamiya'));
  assert.equal(mergedGlossary.terms.credits.zh, '积分');
});

test('site i18n glossary rejects unknown top-level fields', () => {
  assert.throws(
    () =>
      parseSiteI18nGlossary({
        preserve: ['Mamamiya'],
        terms: {},
        forbidden: {},
        extra: true,
      }),
    /Unrecognized key/
  );
});

test('localized text check flags unapproved English residuals', () => {
  const issues = checkLocalizedText({
    text: 'Mamamiya 支持 AI API，也包含 unexpected English words。',
    glossary,
    locale: 'zh',
    pageId: 'home',
    pageType: 'seo',
  });

  assert.deepEqual(
    issues
      .filter((issue) => issue.code === 'i18n_english_residual')
      .map((issue) => issue.term),
    ['unexpected', 'English', 'words']
  );
});

test('localized text check preserves multi-word glossary phrases', () => {
  const issues = checkLocalizedText({
    text: 'AI Remover 支持 API。',
    glossary: {
      ...glossary,
      preserve: [...glossary.preserve, 'AI Remover'],
    },
    locale: 'zh',
    pageId: 'home',
    pageType: 'seo',
  });

  assert.deepEqual(issues, []);
});

test('localized text check preserves terms only as standalone phrases', () => {
  const issues = checkLocalizedText({
    text: 'campaign details',
    glossary,
    locale: 'zh',
    pageId: 'home',
    pageType: 'seo',
  });

  assert.deepEqual(
    issues.map((issue) => issue.term),
    ['campaign', 'details']
  );
});

test('localized text check ignores ICU placeholders', () => {
  const issues = checkLocalizedText({
    text: 'アップロードに失敗しました: {reason}',
    glossary,
    locale: 'ja',
    pageId: 'uploader.image.upload_failed_with_reason',
    pageType: 'product-ui',
  });

  assert.deepEqual(issues, []);
});

test('localized text check ignores formatted ICU syntax', () => {
  const issues = checkLocalizedText({
    text: '{count, plural, one {# 件} other {# 件}}を処理しました',
    glossary,
    locale: 'ja',
    pageId: 'uploader.items_processed',
    pageType: 'product-ui',
  });

  assert.deepEqual(issues, []);
});

test('localized text check still scans formatted ICU branch copy', () => {
  const issues = checkLocalizedText({
    text: '{count, plural, one {item} other {items}}を処理しました',
    glossary,
    locale: 'ja',
    pageId: 'uploader.items_processed',
    pageType: 'product-ui',
  });

  assert.deepEqual(
    issues.map((issue) => issue.term),
    ['item', 'items']
  );
});

test('localized text check ignores rich text markup syntax', () => {
  const issues = checkLocalizedText({
    text: "没有找到想要的答案？请联系 <a href='https://discord.gg/HQNnrzjZQS' target='_blank' rel='nofollow noopener noreferrer' class='text-primary font-medium hover:underline'>我们的客服团队</a>",
    glossary,
    locale: 'zh',
    pageId: 'faq.tip',
    pageType: 'seo',
  });

  assert.deepEqual(issues, []);
});

test('localized text check still scans rich text inner copy', () => {
  const issues = checkLocalizedText({
    text: "没有找到想要的答案？请联系 <a href='https://discord.gg/HQNnrzjZQS'>customer support</a>",
    glossary,
    locale: 'zh',
    pageId: 'faq.tip',
    pageType: 'seo',
  });

  assert.deepEqual(
    issues.map((issue) => issue.term),
    ['customer', 'support']
  );
});

test('localized text check ignores HTML entity syntax', () => {
  const issues = checkLocalizedText({
    text: '版权所有 &copy; 2026',
    glossary,
    locale: 'zh',
    pageId: 'footer.copyright',
    pageType: 'seo',
  });

  assert.deepEqual(issues, []);
});

test('forbidden terms are errors for SEO content and warnings for auth/admin', () => {
  const seoIssues = findForbiddenTerms({
    text: '永久免费',
    glossary,
    locale: 'zh',
    pageId: 'home',
    pageType: 'seo',
  });
  assert.equal(seoIssues[0]?.severity, 'error');

  const authIssues = findForbiddenTerms({
    text: '永久免费',
    glossary,
    locale: 'zh',
    pageId: 'auth.sign-in',
    pageType: 'auth',
  });
  assert.equal(authIssues[0]?.severity, 'warning');
});

test('forbidden English terms are matched case-insensitively', () => {
  const issues = findForbiddenTerms({
    text: 'Free Forever and 100% Perfect are blocked.',
    glossary: {
      ...glossary,
      forbidden: {
        allLocales: ['free forever', '100% perfect'],
      },
    },
    locale: 'zh',
    pageId: 'home',
    pageType: 'seo',
  });

  assert.deepEqual(
    issues.map((issue) => issue.term),
    ['free forever', '100% perfect']
  );
});
