const strictForbiddenPageTypes = new Set([
  'seo',
  'blog',
  'docs',
  'legal',
  'product-ui',
]);
const warningForbiddenPageTypes = new Set(['admin', 'auth']);
const englishWordPattern = /\b[A-Za-z][A-Za-z0-9]*(?:[-'][A-Za-z0-9]+)*\b/g;
const icuPlaceholderPattern = /\{\s*[A-Za-z][A-Za-z0-9_]*\s*\}/g;
const visibleJsxTagPattern =
  /<>|<\/>|<\/?[A-Za-z][A-Za-z0-9.:-]*(?:\s[^<>]*)?\/?>/g;
const visibleAttributePattern =
  /\b(?:aria-label|alt|placeholder|title)=["']([^"']*[A-Za-z][^"']*)["']/g;

function normalizeTerm(value) {
  return value.trim().toLocaleLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createStandaloneTermPattern(term) {
  return new RegExp(
    `(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`,
    'gi'
  );
}

function includesI18nExemptReason(line) {
  return /i18n-exempt:\s*\S+/.test(line);
}

function getLineNumberAtIndex(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function isLikelyTypeScriptGenericTag(match, content) {
  const tag = match[0];
  if (tag === '<>' || tag === '</>' || tag.startsWith('</')) {
    return false;
  }

  const startIndex = match.index ?? 0;
  const previousChar = content[startIndex - 1] ?? '';
  if (/[A-Za-z0-9_$.)\]]/.test(previousChar)) {
    return true;
  }

  const tagName = /^<([A-Za-z][A-Za-z0-9.:-]*)/.exec(tag)?.[1] ?? '';
  const afterTag = content.slice(startIndex + tag.length).trimStart();
  return /^[A-Z]/.test(tagName) && /^\([^)]*\)\s*(?:=>|\{)/.test(afterTag);
}

function isLikelyCodeBetweenJsxTags(text) {
  return /[{};]/.test(text) || /=>/.test(text);
}

function collectForbiddenTerms(glossary, locale) {
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
}) {
  return {
    code,
    severity,
    message,
    locale,
    pageId,
    pageType,
    term,
  };
}

export function getForbiddenSeverity(pageType) {
  if (strictForbiddenPageTypes.has(pageType)) {
    return 'error';
  }

  if (warningForbiddenPageTypes.has(pageType)) {
    return 'warning';
  }

  return 'error';
}

export function findForbiddenTerms({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
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

function removePreservedTerms(text, preservedTerms) {
  const orderedTerms = preservedTerms
    .map((term) => term.trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  return orderedTerms.reduce((remainingText, term) => {
    return remainingText.replace(createStandaloneTermPattern(term), ' ');
  }, text);
}

function removeIcuPlaceholders(text) {
  return text.replace(icuPlaceholderPattern, ' ');
}

export function findEnglishResiduals({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
  const textWithoutPreservedTerms = removePreservedTerms(
    removeIcuPlaceholders(text),
    glossary.preserve
  );
  const issues = [];
  const seenTerms = new Set();

  for (const match of textWithoutPreservedTerms.matchAll(englishWordPattern)) {
    const term = match[0];
    const normalizedTerm = normalizeTerm(term);
    if (seenTerms.has(normalizedTerm)) {
      continue;
    }

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

export function findHardcodedVisibleEnglish({ filePath, content }) {
  const issues = [];
  const lines = content.split(/\r?\n/);
  const jsxTags = [...content.matchAll(visibleJsxTagPattern)].filter(
    (match) => !isLikelyTypeScriptGenericTag(match, content)
  );

  for (let index = 0; index < jsxTags.length - 1; index += 1) {
    const currentTag = jsxTags[index];
    const nextTag = jsxTags[index + 1];
    const textStart = (currentTag.index ?? 0) + currentTag[0].length;
    const textEnd = nextTag.index ?? textStart;
    const rawText = content.slice(textStart, textEnd);
    if (isLikelyCodeBetweenJsxTags(rawText)) {
      continue;
    }

    const text = rawText.replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]/.test(text)) {
      continue;
    }

    const startLine = getLineNumberAtIndex(content, textStart);
    const endLine = getLineNumberAtIndex(content, textEnd);
    const matchedLines = lines.slice(startLine - 1, endLine);
    if (matchedLines.some(includesI18nExemptReason)) {
      continue;
    }

    issues.push({
      code: 'i18n_hardcoded_visible_english',
      severity: 'error',
      filePath,
      line: startLine,
      text,
    });
  }

  lines.forEach((line, index) => {
    if (includesI18nExemptReason(line)) {
      return;
    }

    for (const match of line.matchAll(visibleAttributePattern)) {
      issues.push({
        code: 'i18n_hardcoded_visible_english',
        severity: 'error',
        filePath,
        line: index + 1,
        text: match[1].trim(),
      });
    }
  });

  return issues;
}

export function checkLocalizedText({
  text,
  glossary,
  locale,
  pageId,
  pageType,
}) {
  return [
    ...findEnglishResiduals({ text, glossary, locale, pageId, pageType }),
    ...findForbiddenTerms({ text, glossary, locale, pageId, pageType }),
  ];
}
