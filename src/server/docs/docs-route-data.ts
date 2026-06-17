import { createServerFn } from '@tanstack/react-start';

import { defaultLocale } from '@/config/locale';

import { normalizeDocsSlug, type DocsRouteInput } from './docs-route-resolver';

export const loadDocsRouteData = createServerFn({ method: 'GET' })
  .validator((data: unknown): DocsRouteInput => {
    const input =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    return {
      locale: typeof input.locale === 'string' ? input.locale : defaultLocale,
      slug: normalizeDocsSlug(input.slug),
    };
  })
  .handler(async ({ data }) => {
    const { resolveDocsRouteData } = await import('./docs-route-resolver');

    return resolveDocsRouteData(data);
  });
