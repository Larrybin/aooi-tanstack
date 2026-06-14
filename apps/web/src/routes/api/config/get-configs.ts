import { buildGetConfigsLogic } from '@/server/api/config/get-configs-logic';
import { createFileRoute } from '@tanstack/react-router';

import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import { withTanStackCloudflareBindings } from '../../../server/cloudflare-bindings';
import {
  readTanStackPublicUiConfigCached,
  readTanStackPublicUiConfigFresh,
} from '../../../server/public-ui-config-runtime';

const getConfigs = withTanStackCloudflareBindings(
  withApi(
    buildGetConfigsLogic({
      getPublicUiConfigCached: readTanStackPublicUiConfigCached,
      getPublicUiConfigFresh: readTanStackPublicUiConfigFresh,
      resolveConfigConsistencyMode,
    })
  )
);

export const Route = createFileRoute('/api/config/get-configs')({
  server: {
    handlers: {
      GET: ({ request }) => getConfigs(request),
      POST: ({ request }) => getConfigs(request),
    },
  },
});
