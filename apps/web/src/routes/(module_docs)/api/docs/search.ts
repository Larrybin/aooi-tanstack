import { getDocsSearch } from '@/server/api/docs/search-route';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/(module_docs)/api/docs/search')({
  server: {
    handlers: {
      GET: ({ request }) => getDocsSearch(request),
    },
  },
});
