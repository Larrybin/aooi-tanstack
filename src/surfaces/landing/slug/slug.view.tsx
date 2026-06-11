import { useEffect } from 'react';
import { MarkdownPreview } from '@/domains/content/ui/markdown-preview';

import { isRtlLocale } from '@/config/locale';

import type { SlugRouteData } from './slug.types';

export function SlugSurfaceView({ data }: { data: SlugRouteData }) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <main className="bg-background text-foreground min-h-screen">
      <article className="mx-auto w-full max-w-4xl px-6 py-20 md:px-8 md:py-28">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-normal md:text-5xl">
            {data.page.title}
          </h1>
          {data.page.description && (
            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base md:text-lg">
              {data.page.description}
            </p>
          )}
          {data.page.createdAt && (
            <p className="text-muted-foreground mt-4 text-sm">
              {data.page.createdAt}
            </p>
          )}
        </header>

        <div className="bg-card rounded-lg border px-5 py-6 shadow-sm md:px-8 md:py-8">
          <MarkdownPreview content={data.page.content} />
        </div>
      </article>
    </main>
  );
}
