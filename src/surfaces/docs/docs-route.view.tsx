import { useState, type FormEvent } from 'react';
import { MarkdownPreview } from '@/domains/content/ui/markdown-preview';
import type { DocsSearchResult } from '@/server/api/docs/search-index';
import type {
  DocsRouteData,
  SerializableDocsPageTreeItem,
} from '@/server/docs/docs-route-resolver';

import { defaultLocale } from '@/config/locale';

const docsLocales = [
  { name: 'English', locale: 'en' },
  { name: '简体中文', locale: 'zh' },
];

export function DocsRouteView({ data }: { data: DocsRouteData }) {
  const currentUrl = localizeDocsPath(data.slug, data.locale);

  return (
    <div className="docs-shell">
      <header className="docs-shell-header">
        <a className="docs-shell-brand" href={localizeDocsRoot(data.locale)}>
          <DocsNavTitle data={data} />
        </a>
        <div className="docs-shell-header-actions">
          <DocsSearchBox locale={data.locale} />
          <nav
            className="docs-shell-locales"
            aria-label="Documentation locales"
          >
            {docsLocales.map((item) => (
              <a
                key={item.locale}
                href={localizeDocsPath(data.slug, item.locale)}
                aria-current={item.locale === data.locale ? 'page' : undefined}
              >
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <div className="docs-shell-body">
        <aside className="docs-shell-sidebar">
          <nav aria-label={data.docsTree.name}>
            {data.docsTree.children.map((item) => (
              <DocsTreeLink
                key={item.url}
                item={item}
                currentUrl={currentUrl}
              />
            ))}
          </nav>
        </aside>
        <main role="main" className="docs-shell-main">
          <h1>{data.title}</h1>
          {data.description ? (
            <p className="docs-shell-description">{data.description}</p>
          ) : null}
          <article className="docs-shell-article">
            <MarkdownPreview content={data.content} />
          </article>
        </main>
      </div>
    </div>
  );
}

function DocsSearchBox({ locale }: { locale: string }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DocsSearchResult[]>([]);
  const searchLabel = locale === 'zh' ? '搜索内容' : 'Search docs';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/docs/search?query=${encodeURIComponent(trimmedQuery)}&locale=${encodeURIComponent(locale)}`
      );
      setResults(
        response.ok ? ((await response.json()) as DocsSearchResult[]) : []
      );
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <form className="docs-shell-search" onSubmit={onSubmit}>
      <input
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
      />
      <button type="submit" disabled={isSearching}>
        {isSearching ? '...' : searchLabel}
      </button>
      {results.length > 0 ? (
        <div className="docs-shell-search-results">
          {results.map((result) => (
            <a key={result.id} href={result.url}>
              <span>{result.content}</span>
              {result.breadcrumbs?.length ? (
                <small>{result.breadcrumbs.join(' / ')}</small>
              ) : null}
            </a>
          ))}
        </div>
      ) : null}
    </form>
  );
}

function DocsTreeLink({
  currentUrl,
  item,
}: {
  currentUrl: string;
  item: SerializableDocsPageTreeItem;
}) {
  return (
    <a
      className="docs-shell-sidebar-link"
      href={item.url}
      aria-current={item.url === currentUrl ? 'page' : undefined}
    >
      <span>{item.name}</span>
      {item.description ? <small>{item.description}</small> : null}
    </a>
  );
}

function DocsNavTitle({ data }: { data: DocsRouteData }) {
  return (
    <>
      {data.appLogo ? (
        <img src={data.appLogo} alt={data.appName} width={28} height={28} />
      ) : null}
      <span>{data.appName}</span>
    </>
  );
}

function localizeDocsRoot(locale: string) {
  return locale === defaultLocale ? '/docs' : `/${locale}/docs`;
}

function localizeDocsPath(slug: string[], locale: string) {
  const suffix = slug.length > 0 ? `/${slug.join('/')}` : '';
  return `${localizeDocsRoot(locale)}${suffix}`;
}
