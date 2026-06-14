import { getTextToSpeechHistory } from '@/server/api/tts/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const getHistory = withTanStackCloudflareBindings(getTextToSpeechHistory);

export const Route = createFileRoute('/api/tts/history')({
  server: {
    handlers: {
      GET: ({ request }) => getHistory(request),
    },
  },
});
