import { createApiContext } from '@/app/api/_lib/context';
import {
  createTextToSpeechGeneration,
  deleteOverflowTextToSpeechGenerationsForOwner,
  findReusableTextToSpeechGeneration,
} from '@/domains/text-to-speech-generator/infra/generation';
import { getStorageService } from '@/infra/adapters/storage/service';

import { withApi } from '@/shared/lib/api/route';

import { requireTextToSpeechGeneratorSite } from '../_lib/guard';
import { resolveTextToSpeechActor } from '../actor.server';
import { createTextToSpeechGeneratePostAction } from './action';
import { createCloudflareTextToSpeechProvider } from './provider.server';

const postAction = createTextToSpeechGeneratePostAction({
  createApiContext,
  resolveActor: resolveTextToSpeechActor,
  provider: createCloudflareTextToSpeechProvider(),
  getStorageService,
  findReusableGeneration: findReusableTextToSpeechGeneration,
  createGeneration: createTextToSpeechGeneration,
  deleteOverflowGenerations: deleteOverflowTextToSpeechGenerationsForOwner,
});

export const POST = withApi((req: Request) => {
  requireTextToSpeechGeneratorSite();
  return postAction(req);
});
