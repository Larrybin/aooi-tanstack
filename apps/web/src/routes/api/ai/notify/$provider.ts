import { createAiNotifyPostAction } from '@/server/api/ai/notify-route';
import {
  getAiNotifyWebhookSecret,
  verifyAiNotifyCallbackSignature,
} from '@/server/api/ai/notify-signature';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';
import { readRequestBodyByteCountUpTo } from '@/shared/lib/runtime/request-body';

import { createTanStackApiContext } from '../../../../server/api-context';
import { withTanStackCloudflareBindings } from '../../../../server/cloudflare-bindings';

const postAction = createAiNotifyPostAction({
  getLog: (request) => createTanStackApiContext(request).log,
  getAiNotifyWebhookSecret,
  verifyAiNotifyCallbackSignature,
  readRequestBodyByteCountUpTo,
});

const postAiNotify = withTanStackCloudflareBindings(
  withApi((request: Request, context?: unknown) => {
    const provider =
      typeof context === 'object' &&
      context &&
      'provider' in context &&
      typeof (context as { provider: unknown }).provider === 'string'
        ? (context as { provider: string }).provider
        : '';

    return postAction(request, { provider });
  })
);

export const Route = createFileRoute('/api/ai/notify/$provider')({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        postAiNotify(request, { provider: params.provider }),
    },
  },
});
