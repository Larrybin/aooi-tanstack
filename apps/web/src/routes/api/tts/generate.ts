import { postTextToSpeechGenerate } from '@/server/api/tts/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const postGenerate = withTanStackCloudflareBindings(postTextToSpeechGenerate);

export const Route = createFileRoute('/api/tts/generate')({
  server: {
    handlers: {
      POST: ({ request }) => postGenerate(request),
    },
  },
});
