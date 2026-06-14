import { getTextToSpeechDownload } from '@/server/api/tts/routes';
import { createFileRoute } from '@tanstack/react-router';

import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const getDownload = withTanStackCloudflareBindings(getTextToSpeechDownload);

export const Route = createFileRoute('/api/tts/download/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => getDownload(request, { params }),
    },
  },
});
