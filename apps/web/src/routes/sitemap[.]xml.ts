import { createFileRoute } from '@tanstack/react-router';

import { buildSitemapXml } from '@/shared/seo/sitemap';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(buildSitemapXml(), {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        }),
    },
  },
});
