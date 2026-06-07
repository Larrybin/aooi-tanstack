import { createApiContext } from '@/app/api/_lib/context';
import {
  consumeCredits,
  refundConsumedCreditById,
} from '@/domains/account/infra/credit';
import {
  createTextToSpeechGeneration,
  deleteOverflowTextToSpeechGenerationsForOwner,
  findReusableTextToSpeechGeneration,
  markTextToSpeechGenerationDeletedById,
} from '@/domains/text-to-speech-generator/infra/generation';
import {
  commitTextToSpeechQuotaReservation,
  countTextToSpeechMonthlyQuotaUnits,
  refundTextToSpeechQuotaReservation,
  reserveTextToSpeechQuota,
} from '@/domains/text-to-speech-generator/infra/quota';
import { getStorageService } from '@/infra/adapters/storage/service';

import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { withApi } from '@/shared/lib/api/route';

import { requireTextToSpeechGeneratorSite } from '../_lib/guard';
import { resolveTextToSpeechActor } from '../actor.server';
import {
  acquireTextToSpeechGuestIpLimit,
  resolveTextToSpeechGuestIp,
} from '../guest-ip-limit';
import { verifyTextToSpeechTurnstile } from '../turnstile.server';
import { createTextToSpeechGeneratePostAction } from './action';
import { createCloudflareTextToSpeechProvider } from './provider.server';

const limiterFactory = createLimiterFactory();

const postAction = createTextToSpeechGeneratePostAction({
  createApiContext,
  resolveActor: resolveTextToSpeechActor,
  provider: createCloudflareTextToSpeechProvider(),
  getStorageService,
  findReusableGeneration: findReusableTextToSpeechGeneration,
  createGeneration: createTextToSpeechGeneration,
  markGenerationDeleted: markTextToSpeechGenerationDeletedById,
  deleteOverflowGenerations: deleteOverflowTextToSpeechGenerationsForOwner,
  countMonthlyQuotaUnits: countTextToSpeechMonthlyQuotaUnits,
  reserveMonthlyQuota: reserveTextToSpeechQuota,
  commitMonthlyQuota: commitTextToSpeechQuotaReservation,
  refundMonthlyQuota: refundTextToSpeechQuotaReservation,
  consumeCredits,
  refundConsumedCredit: refundConsumedCreditById,
  verifyTurnstile: ({ actor, token, req }) =>
    verifyTextToSpeechTurnstile({
      actor,
      token,
      req,
      remoteIp: resolveTextToSpeechGuestIp(req),
      trustLimiter: limiterFactory.createTextToSpeechTurnstileTrustLimiter(),
    }),
  acquireGuestIpLimit: ({ actor, req }) =>
    acquireTextToSpeechGuestIpLimit({
      actor,
      req,
      limiter: limiterFactory.createTextToSpeechGuestPreviewLimiter(),
    }),
});

export const POST = withApi((req: Request) => {
  requireTextToSpeechGeneratorSite();
  return postAction(req);
});
