import { createFileRoute } from '@tanstack/react-router';

import { postAiGenerate } from '../../../server/handlers/ai';

export const Route = createFileRoute('/api/ai/generate')({
  server: {
    handlers: {
      POST: ({ request }) => postAiGenerate(request),
    },
  },
});
