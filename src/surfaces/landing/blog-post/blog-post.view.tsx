import { useEffect } from 'react';
import { MarkdownPreview } from '@/domains/content/ui/markdown-preview';

import { isRtlLocale } from '@/config/locale';

import { LandingShellView } from '../shell/landing-shell.view';

import type { BlogPostAdZoneData, BlogPostRouteData } from './blog-post.types';

export function BlogPostSurfaceView({ data }: { data: BlogPostRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  const hasToc = data.post.toc.length > 0;
  const hasAuthor =
    data.post.authorName || data.post.authorImage || data.post.authorRole;
  const contentSplit = data.adZones.inline
    ? splitBlogContentForInlineAd(data.post.content)
    : null;

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
            {contentSplit ? (
              <>
                <MarkdownPreview content={contentSplit.before} />
                <BlogPostAdZoneView adZone={data.adZones.inline} />
                <MarkdownPreview content={contentSplit.after} />
              </>
            ) : (
              <>
                <MarkdownPreview content={data.post.content} />
                <BlogPostAdZoneView adZone={data.adZones.inline} />
              </>
            )}
            <BlogPostAdZoneView adZone={data.adZones.footer} />
          </div>

          {hasAuthor ? (
            <aside className="blog-post-author">
              {data.post.authorImage ? (
                <img src={data.post.authorImage} alt={data.post.authorName} />
              ) : null}
              {data.post.authorName ? <strong>{data.post.authorName}</strong> : null}
              {data.post.authorRole ? <span>{data.post.authorRole}</span> : null}
            </aside>
          ) : null}
        </div>
      </article>
    </LandingShellView>
  );
}

function BlogPostAdZoneView({
  adZone,
}: {
  adZone: BlogPostAdZoneData | null;
}) {
  useEffect(() => {
    if (adZone?.provider !== 'adsense') {
      return;
    }

    try {
      const adWindow = window as Window & {
        adsbygoogle?: Array<Record<string, unknown>>;
      };
      adWindow.adsbygoogle = adWindow.adsbygoogle || [];
      adWindow.adsbygoogle.push({});
    } catch {
      // Ignore third-party script initialization errors so the page stays usable.
    }
  }, [adZone]);

  if (!adZone) {
    return null;
  }

  return (
    <section className="blog-post-ad-zone" data-ad-zone={adZone.zone}>
      <div className="blog-post-ad-zone-label">Sponsored · {adZone.title}</div>
      <div className="blog-post-ad-zone-content">
        {adZone.provider === 'adsense' ? (
          <>
            <script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adZone.clientId}`}
              crossOrigin="anonymous"
            />
            <ins
              className="adsbygoogle block min-h-[120px] w-full"
              style={{ display: 'block' }}
              data-ad-client={adZone.clientId}
              data-ad-slot={adZone.slot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: adZone.html }} />
        )}
      </div>
    </section>
  );
}

function splitBlogContentForInlineAd(content: string) {
  const sections = content
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length < 6) {
    return null;
  }

  const splitIndex = Math.min(
    sections.length - 2,
    Math.max(3, Math.floor(sections.length * 0.6))
  );

  return {
    before: sections.slice(0, splitIndex).join('\n\n'),
    after: sections.slice(splitIndex).join('\n\n'),
  };
}

function localizeBlogHref(locale: string) {
  return locale === 'en' ? '/blog' : `/${locale}/blog`;
}
