import { useEffect } from 'react';

import { isRtlLocale } from '@/config/locale';

import { LandingShellView } from '../shell/landing-shell.view';
import type { BlogCategoryRouteData } from './blog-category.types';

export function BlogCategorySurfaceView({
  data,
}: {
  data: BlogCategoryRouteData;
}) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <LandingShellView shell={data.shell}>
      <section className="blog-category-page" id={data.blog.id}>
        <header className="blog-category-header">
          {data.blog.srOnlyTitle ? (
            <h1 className="sr-only">{data.blog.srOnlyTitle}</h1>
          ) : null}
          <h2>{data.blog.currentCategory.title || data.blog.title}</h2>
          {data.blog.currentCategory.description || data.blog.description ? (
            <p>
              {data.blog.currentCategory.description || data.blog.description}
            </p>
          ) : null}
        </header>

        {data.blog.categories.length > 0 ? (
          <nav className="blog-category-tabs" aria-label={data.blog.title}>
            {data.blog.categories.map((category) => (
              <a
                key={category.id || category.slug}
                href={category.url}
                aria-current={category.isActive ? 'page' : undefined}
              >
                {category.title}
              </a>
            ))}
          </nav>
        ) : null}

        {data.blog.posts.length > 0 ? (
          <div className="blog-category-posts">
            {data.blog.posts.map((post) => (
              <a
                className="blog-category-post-card"
                key={post.id}
                href={post.url}
              >
                {post.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- TanStack routes cannot use next/image.
                  <img src={post.image} alt={post.title} loading="lazy" />
                ) : null}
                <span className="blog-category-post-body">
                  <strong>{post.title}</strong>
                  {post.description ? <span>{post.description}</span> : null}
                  <span className="blog-category-post-meta">
                    {post.createdAt ? (
                      <time dateTime={post.createdAt}>{post.createdAt}</time>
                    ) : null}
                    {post.authorName ? <span>{post.authorName}</span> : null}
                  </span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="blog-category-empty">{data.copy.emptyLabel}</p>
        )}
      </section>
    </LandingShellView>
  );
}
