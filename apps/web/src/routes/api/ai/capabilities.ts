import { listConfiguredAICapabilities } from '@/domains/ai/application/capabilities-core';
import { createAiCapabilitiesGetHandler } from '@/server/api/ai/capabilities-route';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';

import {
  readTanStackAiProviderBindings,
  readTanStackAiRuntimeSettings,
} from '../../../server/ai-runtime';
import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';

const getAiCapabilities = withTanStackCloudflareBindings(
  withApi(
    createAiCapabilitiesGetHandler({
      listCapabilities: async () =>
        listConfiguredAICapabilities(
          await readTanStackAiRuntimeSettings(),
          await readTanStackAiProviderBindings()
        ),
    })
  )
);

export const Route = createFileRoute('/api/ai/capabilities')({
  server: {
    handlers: {
      GET: () => getAiCapabilities(),
    },
  },
});
