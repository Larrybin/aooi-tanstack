import type { SiteI18nIssue } from './site-i18n-check.ts';
import type { MergedI18nGlossary } from './site-i18n-glossary.ts';
import type { SiteI18nPage } from './site-i18n-pages.ts';

type PageType = SiteI18nPage['type'];
type IssueSeverity = SiteI18nIssue['severity'];
type LocalizedTextInput = {
  text: string;
  glossary: MergedI18nGlossary;
  locale: string;
  pageId: string;
  pageType: PageType;
};

const strictForbiddenPageTypes: ReadonlySet<PageType> = new Set([
  'seo',
  'blog',
  'docs',
  'legal',
  'product-ui',
]);
const warningForbiddenPageTypes: ReadonlySet<PageType> = new Set([
  'admin',
  'auth',
]);
const englishWordPattern = /\b[A-Za-z][A-Za-z0-9]*(?:[-'][A-Za-z0-9]+)*\b/g;
const htmlEntityReplacements: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['copy', ' '],
  ['gt', '>'],
  ['lt', '<'],
  ['mdash', ' '],
  ['nbsp', ' '],
  ['ndash', ' '],
  ['quot', '"'],
  ['reg', ' '],
  ['trade', ' '],
]);

function normalizeTerm(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createStandaloneTermPattern(term: string): RegExp {
  return new RegExp(
    `(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`,
    'gi'
  );
}

function collectForbiddenTerms(
  glossary: MergedI18nGlossary,
  locale: string
): string[] {
  return [
    ...(glossary.forbidden.allLocales ?? []),
    ...(glossary.forbidden[locale] ?? []),
  ];
}

function createIssue({
  code,
  severity,
  message,
  locale,
  pageId,
  pageType,
  term,
}: {
  code: string;
  severity: IssueSeverity;
  message: string;
  locale: string;
  pageId: string;
  pageType: PageType;
  term: string;
}): SiteI18nIssue {
  return { code, severity, message, locale, pageId, pageType, term };
}

export function getForbiddenSeverity(pageType: PageType): IssueSeverity {
  if (strictForbiddenPageTypes.has(pageType)) return 'error';
  if (warningForbiddenPageTypes.has(pageType)) return 'warning';
  return 'error';
}

export function findForbiddenTerms({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}: LocalizedTextInput): SiteI18nIssue[] {
  const severity = getForbiddenSeverity(pageType);
  const normalizedText = normalizeTerm(text);

  return collectForbiddenTerms(glossary, locale)
    .filter((term) => normalizedText.includes(normalizeTerm(term)))
    .map((term) =>
      createIssue({
        code: 'i18n_forbidden_term',
        severity,
        message: `forbidden term "${term}" is not allowed`,
        locale,
        pageId,
        pageType,
        term,
      })
    );
}

function removePreservedTerms(
  text: string,
  preservedTerms: readonly string[]
): string {
  const orderedTerms = preservedTerms
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  return orderedTerms.reduce(
    (remainingText, term) =>
      remainingText.replace(createStandaloneTermPattern(term), ' '),
    text
  );
}

function decodeHtmlEntity(entity: string): string {
  const normalizedEntity = entity.toLocaleLowerCase();
  if (normalizedEntity.startsWith('#x')) {
    return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(2), 16));
  }
  if (normalizedEntity.startsWith('#')) {
    return String.fromCodePoint(Number.parseInt(normalizedEntity.slice(1), 10));
  }
  return htmlEntityReplacements.get(normalizedEntity) ?? ' ';
}

function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[A-Za-z][A-Za-z0-9]+);/gi,
    (_match: string, entity: string) => decodeHtmlEntity(entity)
  );
}

function findClosingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function collectIcuBranchText(block: string): string {
  let branchText = '';
  for (let index = 0; index < block.length; index += 1) {
    if (block[index] !== '{') continue;
    const closingBrace = findClosingBrace(block, index);
    if (closingBrace < 0) break;
    branchText += ` ${stripIcuMessageSyntax(
      block.slice(index + 1, closingBrace)
    )} `;
    index = closingBrace;
  }
  return branchText || ' ';
}

function stripIcuBlock(block: string): string {
  const trimmedBlock = block.trim();
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmedBlock)) return ' ';
  if (
    /^[A-Za-z][A-Za-z0-9_]*\s*,\s*(?:plural|select|selectordinal|number|date|time)\b/.test(
      trimmedBlock
    )
  ) {
    return collectIcuBranchText(block);
  }
  return stripIcuMessageSyntax(block);
}

function stripIcuMessageSyntax(text: string): string {
  let strippedText = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{') {
      strippedText += text[index];
      continue;
    }
    const closingBrace = findClosingBrace(text, index);
    if (closingBrace < 0) {
      strippedText += text[index];
      continue;
    }
    strippedText += stripIcuBlock(text.slice(index + 1, closingBrace));
    index = closingBrace;
  }
  return strippedText;
}

function removeIcuPlaceholders(text: string): string {
  return stripIcuMessageSyntax(text);
}

function isMarkupTag(tagText: string): boolean {
  return /^\/?[A-Za-z][A-Za-z0-9:-]*(?:\s|\/|$)/.test(tagText.trim());
}

function stripMarkupSyntax(text: string): string {
  let strippedText = '';
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '<') {
      strippedText += text[index];
      continue;
    }
    const tagEnd = text.indexOf('>', index + 1);
    if (tagEnd < 0 || !isMarkupTag(text.slice(index + 1, tagEnd))) {
      strippedText += text[index];
      continue;
    }
    strippedText += ' ';
    index = tagEnd;
  }
  return strippedText;
}

export function findEnglishResiduals({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}: LocalizedTextInput): SiteI18nIssue[] {
  const textWithoutPreservedTerms = removePreservedTerms(
    stripMarkupSyntax(removeIcuPlaceholders(decodeHtmlEntities(text))),
    glossary.preserve
  );
  const issues: SiteI18nIssue[] = [];
  const seenTerms = new Set<string>();

  for (const match of textWithoutPreservedTerms.matchAll(englishWordPattern)) {
    const term = match[0];
    const normalizedTerm = normalizeTerm(term);
    if (seenTerms.has(normalizedTerm)) continue;
    seenTerms.add(normalizedTerm);
    issues.push(
      createIssue({
        code: 'i18n_english_residual',
        severity: 'error',
        message: `unapproved English residual "${term}" found`,
        locale,
        pageId,
        pageType,
        term,
      })
    );
  }

  return issues;
}

export function checkLocalizedText(input: LocalizedTextInput): SiteI18nIssue[] {
  return [...findEnglishResiduals(input), ...findForbiddenTerms(input)];
}
