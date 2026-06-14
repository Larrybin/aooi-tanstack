export type DocsSearchDocument = {
  locale: string;
  slug: string;
  path: string;
  title: string;
  description: string;
  content: string;
  toc: Array<{
    title: string;
    url: string;
    depth: number;
  }>;
};

export type DocsSearchResult = {
  id: string;
  url: string;
  type: 'page' | 'heading' | 'text';
  content: string;
  breadcrumbs?: string[];
};

type SearchDocsIndexInput = {
  documents: readonly DocsSearchDocument[];
  query: string;
  locale?: string | null;
  limit?: number;
};

type ScoredResult = DocsSearchResult & { score: number };

const DEFAULT_RESULT_LIMIT = 20;

export function searchDocsIndex({
  documents,
  query,
  locale,
  limit = DEFAULT_RESULT_LIMIT,
}: SearchDocsIndexInput): DocsSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery.split(' ').filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return documents
    .filter((document) => {
      if (!locale) return true;
      return document.locale === locale;
    })
    .flatMap((document) => scoreDocument(document, terms))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return `${left.url}:${left.type}:${left.content}`.localeCompare(
        `${right.url}:${right.type}:${right.content}`
      );
    })
    .slice(0, limit)
    .map(({ score: _score, ...result }) => result);
}

export async function searchPublicDocsIndex(input: {
  query: string;
  locale?: string | null;
  limit?: number;
}) {
  const { getLocalPublicContentDocuments } = await import(
    '@/domains/content/application/public-content-manifest'
  );

  return searchDocsIndex({
    ...input,
    documents: getLocalPublicContentDocuments({
      collection: 'docs',
      locale: input.locale ?? undefined,
    }),
  });
}

function scoreDocument(
  document: DocsSearchDocument,
  terms: readonly string[]
): ScoredResult[] {
  const results: ScoredResult[] = [];
  const titleScore = scoreText(document.title, terms) * 8;
  const descriptionScore = scoreText(document.description, terms) * 4;
  const contentScore = scoreText(document.content, terms);
  const pageScore = titleScore + descriptionScore + contentScore;

  if (pageScore > 0) {
    results.push({
      id: `docs:${document.locale}:${document.slug || 'index'}:page`,
      url: document.path,
      type: 'page',
      content: document.title || document.path,
      breadcrumbs: buildBreadcrumbs(document),
      score: pageScore,
    });
  }

  for (const heading of document.toc) {
    const headingScore = scoreText(heading.title, terms) * 6;
    if (headingScore <= 0) continue;

    results.push({
      id: `docs:${document.locale}:${document.slug || 'index'}:heading:${heading.url}`,
      url: `${document.path}${heading.url}`,
      type: 'heading',
      content: heading.title,
      breadcrumbs: buildBreadcrumbs(document),
      score: headingScore,
    });
  }

  const snippet = createContentSnippet(document.content, terms);
  if (snippet) {
    results.push({
      id: `docs:${document.locale}:${document.slug || 'index'}:text`,
      url: document.path,
      type: 'text',
      content: snippet,
      breadcrumbs: buildBreadcrumbs(document),
      score: scoreText(snippet, terms),
    });
  }

  return results;
}

function buildBreadcrumbs(document: DocsSearchDocument) {
  return document.title ? [document.title] : undefined;
}

function scoreText(value: string, terms: readonly string[]) {
  const normalizedValue = normalizeSearchText(value);
  if (!normalizedValue) return 0;

  return terms.reduce((score, term) => {
    if (!normalizedValue.includes(term)) return score;
    return score + (normalizedValue === term ? 2 : 1);
  }, 0);
}

function createContentSnippet(value: string, terms: readonly string[]) {
  const normalizedValue = normalizeSearchText(value);
  const firstTerm = terms.find((term) => normalizedValue.includes(term));
  if (!firstTerm) return null;

  const originalIndex = normalizedValue.indexOf(firstTerm);
  const start = Math.max(0, originalIndex - 80);
  const end = Math.min(value.length, originalIndex + firstTerm.length + 140);
  return value.slice(start, end).replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}
