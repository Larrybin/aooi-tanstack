import { getAdsTxtBody } from '@/infra/adapters/ads/runtime';
import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import { createFileRoute } from '@tanstack/react-router';

import { readTanStackAdsRuntimeFresh } from '../server/ads-runtime';

function buildAdsTxtResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export const Route = createFileRoute('/ads.txt')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { log } = getRequestLogger(request);
        try {
          const runtime = await readTanStackAdsRuntimeFresh();
          return buildAdsTxtResponse(getAdsTxtBody(runtime));
        } catch (error) {
          log.error('ads.txt: get configs failed', { error });
          return buildAdsTxtResponse('');
        }
      },
    },
  },
});
