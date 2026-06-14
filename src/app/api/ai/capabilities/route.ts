import { listPublicAICapabilities } from '@/domains/ai/application/capabilities';
import { createAiCapabilitiesGetHandler } from '@/server/api/ai/capabilities-route';

import { withApi } from '@/shared/lib/api/route';

export const GET = withApi(
  createAiCapabilitiesGetHandler({
    listCapabilities: listPublicAICapabilities,
  })
);
