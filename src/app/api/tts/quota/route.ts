import { createApiContext } from '@/app/api/_lib/context';
import { getRemainingCredits } from '@/domains/account/infra/credit';
import { resolveTextToSpeechQuotaSummary } from '@/domains/text-to-speech-generator/application/quota';
import { countTextToSpeechMonthlyQuotaUnits } from '@/domains/text-to-speech-generator/infra/quota';

import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import { requireTextToSpeechGeneratorSite } from '../_lib/guard';
import { resolveTextToSpeechActor } from '../actor.server';

export const GET = withApi(async (req: Request) => {
  requireTextToSpeechGeneratorSite();
  createApiContext(req);
  const actor = await resolveTextToSpeechActor(req);
  const quota = await resolveTextToSpeechQuotaSummary({
    actor,
    deps: {
      countMonthlyQuotaUnits: countTextToSpeechMonthlyQuotaUnits,
      getRemainingCredits,
    },
  });

  return jsonOk(quota, { headers: { 'Cache-Control': 'no-store' } });
});
