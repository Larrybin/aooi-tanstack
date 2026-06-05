import { createApiContext } from '@/app/api/_lib/context';

import { withApi } from '@/shared/lib/api/route';

import { requireTextToSpeechGeneratorSite } from '../_lib/guard';
import { createTextToSpeechGeneratePostAction } from './action';
import { createCloudflareTextToSpeechProvider } from './provider.server';

const postAction = createTextToSpeechGeneratePostAction({
  createApiContext,
  resolveActorKind: async () => 'guest',
  provider: createCloudflareTextToSpeechProvider(),
});

export const POST = withApi((req: Request) => {
  requireTextToSpeechGeneratorSite();
  return postAction(req);
});
