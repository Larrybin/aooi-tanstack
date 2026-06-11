import { useEffect } from 'react';
import { MarkdownPreview } from '@/domains/content/ui/markdown-preview';

import { isRtlLocale } from '@/config/locale';

import { LandingShellView } from '../shell/landing-shell.view';

import type { SlugRouteData } from './slug.types';

export function SlugSurfaceView({ data }: { data: SlugRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <LandingShellView shell={data.shell}>
      <article className="slug-article">
        <header className="slug-article-header">
          <h1>
            {data.page.title}
          </h1>
          {data.page.description && (
            <p className="slug-article-description">
              {data.page.description}
            </p>
          )}
          {data.page.createdAt && (
            <p className="slug-article-date">
              {data.page.createdAt}
            </p>
          )}
        </header>

        <div className="slug-article-card">
          <MarkdownPreview content={data.page.content} />
        </div>
      </article>
    </LandingShellView>
  );
}
