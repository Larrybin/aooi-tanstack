import { createFileRoute } from '@tanstack/react-router';

import { getAdsTxt } from '../../server/handlers/ads';

export const Route = createFileRoute('/(module_ads)/ads.txt')({
  server: {
    handlers: {
      GET: ({ request }) => getAdsTxt(request),
    },
  },
});
