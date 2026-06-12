import { useEffect } from 'react';
import { MarkdownPreview } from '@/domains/content/ui/markdown-preview';

import { isRtlLocale } from '@/config/locale';

import { LandingShellView } from '../shell/landing-shell.view';

import type { BlogPostRouteData } from './blog-post.types';

export function BlogPostSurfaceView({ data }: { data: BlogPostRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  const hasToc = data.post.toc.length > 0;
  const hasAuthor = data.post.authorName || data.post.authorImage;

  return (
    <LandingShellView shell={data.shell}>
      <article className="blog-post-article">
        <nav className="blog-post-crumb" aria-label="Breadcrumb">
          <a href={localizeBlogHref(data.locale)}>{data.copy.blogLabel}</a>
          <span aria-hidden="true">/</span>
          <span>{data.post.title}</span>
        </nav>

        <header className="blog-post-header">
          <h1>{data.post.title}</h1>
          {data.post.description ? <p>{data.post.description}</p> : null}
          {data.post.createdAt ? (
            <time dateTime={data.post.createdAt}>{data.post.createdAt}</time>
          ) : null}
        </header>

        <div className="blog-post-layout">
          {hasToc ? (
            <aside className="blog-post-toc" aria-label={data.copy.tocLabel}>
              <strong>{data.copy.tocLabel}</strong>
              <nav>
                {data.post.toc.map((item) => (
                  <a
                    key={`${item.url}:${item.title}`}
                    href={item.url}
                    data-depth={item.depth}
                  >
                    {item.title}
                  </a>
                ))}
              </nav>
            </aside>
          ) : null}

          <div className="blog-post-content-card">
            <MarkdownPreview content={data.post.content} />
          </div>

          {hasAuthor ? (
            <aside className="blog-post-author">
              {data.post.authorImage ? (
                <img src={data.post.authorImage} alt={data.post.authorName} />
              ) : null}
              {data.post.authorName ? <strong>{data.post.authorName}</strong> : null}
            </aside>
          ) : null}
        </div>
      </article>
    </LandingShellView>
  );
}

function localizeBlogHref(locale: string) {
  return locale === 'en' ? '/blog' : `/${locale}/blog`;
}
