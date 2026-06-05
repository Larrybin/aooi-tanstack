import { createApiContext } from '@/app/api/_lib/context';
import { listTextToSpeechHistory } from '@/domains/text-to-speech-generator/application/history';
import { listTextToSpeechGenerationsForOwner } from '@/domains/text-to-speech-generator/infra/generation';

import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireTextToSpeechGeneratorSite } from '../_lib/guard';
import { resolveTextToSpeechActor } from '../actor.server';

export const GET = withApi(async (req: Request) => {
  requireTextToSpeechGeneratorSite();
  createApiContext(req);
  const actor = await resolveTextToSpeechActor(req);
  const history = await listTextToSpeechHistory({
    actor,
    deps: {
      listGenerations: listTextToSpeechGenerationsForOwner,
    },
  });

  return jsonOk(
    { items: history },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
