import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkLocalizedText,
  findForbiddenTerms,
  findHardcodedVisibleEnglish,
} from '../../scripts/lib/site-i18n-content-gates.mjs';
import {
  parseSiteI18nGlossary,
  readMergedI18nGlossary,
} from '../../scripts/lib/site-i18n-glossary.mjs';

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

test('hardcoded visible English scanner catches JSX text and common attributes', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content: [
      'export function Example() {',
      '  return <button aria-label="Start upload">Upload image</button>;',
      '}',
    ].join('\n'),
  });

  assert.deepEqual(
    issues.map((issue) => issue.text),
    ['Upload image', 'Start upload']
  );
});

test('hardcoded visible English scanner catches text around inline JSX children', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content: [
      'export function Example() {',
      '  return <p>Read <a href="/docs">docs</a> now</p>;',
      '}',
    ].join('\n'),
  });

  assert.deepEqual(
    issues.map((issue) => issue.text),
    ['Read', 'docs', 'now']
  );
});

test('hardcoded visible English scanner catches fragment text before inline children', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content: [
      'export function Example() {',
      '  return <>Upload <Icon /></>;',
      '}',
    ].join('\n'),
  });

  assert.deepEqual(
    issues.map((issue) => issue.text),
    ['Upload']
  );
});

test('hardcoded visible English scanner catches multiline JSX text', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content: [
      'export function Example() {',
      '  return <button>',
      '    Upload image',
      '  </button>;',
      '}',
    ].join('\n'),
  });

  assert.deepEqual(issues, [
    {
      code: 'i18n_hardcoded_visible_english',
      severity: 'error',
      filePath: 'src/app/example.tsx',
      line: 2,
      text: 'Upload image',
    },
  ]);
});

test('hardcoded visible English scanner ignores comparison before JSX branches', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content: [
      'export function Example({ width, minWidth }: Props) {',
      '  return width > minWidth ? <Icon /> : null;',
      '}',
    ].join('\n'),
  });

  assert.deepEqual(issues, []);
});

test('hardcoded visible English scanner ignores TSX generic declarations', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content: [
      'type Item = { id: string };',
      'export function List<T extends Item>() {',
      '  return <div />;',
      '}',
      'const Grid = <TItem extends Item>(props: Props<TItem>) => <div />;',
    ].join('\n'),
  });

  assert.deepEqual(issues, []);
});

test('hardcoded visible English scanner requires an explicit exempt reason', () => {
  const issues = findHardcodedVisibleEnglish({
    filePath: 'src/app/example.tsx',
    content:
      '<span aria-label="Debug token">Debug token</span> /* i18n-exempt: test fixture */',
  });

  assert.deepEqual(issues, []);
});
