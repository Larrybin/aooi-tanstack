import { createFileRoute } from '@tanstack/react-router';

import { postAiQuery } from '../../../server/handlers/ai';

export const Route = createFileRoute('/api/ai/query')({
  server: {
    handlers: {
      POST: ({ request }) => postAiQuery(request),
    },
  },
});
