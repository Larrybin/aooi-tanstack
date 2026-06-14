import { getTextToSpeechQuota } from '@/server/api/tts/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const getQuota = withTanStackCloudflareBindings(getTextToSpeechQuota);

export const Route = createFileRoute('/api/tts/quota')({
  server: {
    handlers: {
      GET: ({ request }) => getQuota(request),
    },
  },
});
