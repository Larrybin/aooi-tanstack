import {
  consumeCredits,
  getRemainingCredits,
  refundConsumedCreditById,
} from '@/domains/account/infra/credit';
import {
  createTextToSpeechGeneration,
  deleteOverflowTextToSpeechGenerationsForOwner,
  findReusableTextToSpeechGeneration,
  findTextToSpeechGenerationById,
  listTextToSpeechGenerationsForOwner,
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

import { resolveTextToSpeechActor } from './actor';
import { createTextToSpeechApiContext } from './context';
import { requireTextToSpeechGeneratorSite } from './guard';
import {
  acquireTextToSpeechGuestIpLimit,
  resolveTextToSpeechGuestIp,
} from './guest-ip-limit';
import { createCloudflareTextToSpeechProvider } from './provider';
import { createTextToSpeechRoutes } from './routes-core';
import { verifyTextToSpeechTurnstile } from './turnstile';

const limiterFactory = createLimiterFactory();

const routes = createTextToSpeechRoutes({
  acquireGuestIpLimit: ({ actor, req }) =>
    acquireTextToSpeechGuestIpLimit({
      actor,
      req,
      limiter: limiterFactory.createTextToSpeechGuestPreviewLimiter(),
    }),
  commitMonthlyQuota: commitTextToSpeechQuotaReservation,
  consumeCredits,
  countMonthlyQuotaUnits: countTextToSpeechMonthlyQuotaUnits,
  createApiContext: createTextToSpeechApiContext,
  createGeneration: createTextToSpeechGeneration,
  deleteOverflowGenerations: deleteOverflowTextToSpeechGenerationsForOwner,
  findGenerationById: findTextToSpeechGenerationById,
  findReusableGeneration: findReusableTextToSpeechGeneration,
  getRemainingCredits,
  getStorageService,
  listGenerations: listTextToSpeechGenerationsForOwner,
  markGenerationDeleted: markTextToSpeechGenerationDeletedById,
  provider: createCloudflareTextToSpeechProvider(),
  refundConsumedCredit: refundConsumedCreditById,
  refundMonthlyQuota: refundTextToSpeechQuotaReservation,
  requireSite: requireTextToSpeechGeneratorSite,
  reserveMonthlyQuota: reserveTextToSpeechQuota,
  resolveActor: resolveTextToSpeechActor,
  verifyTurnstile: ({ actor, token, req }) =>
    verifyTextToSpeechTurnstile({
      actor,
      token,
      req,
      remoteIp: resolveTextToSpeechGuestIp(req),
      trustLimiter: limiterFactory.createTextToSpeechTurnstileTrustLimiter(),
    }),
});

export const getTextToSpeechDownload = routes.getTextToSpeechDownload;
export const getTextToSpeechHistory = routes.getTextToSpeechHistory;
export const getTextToSpeechQuota = routes.getTextToSpeechQuota;
export const postTextToSpeechGenerate = routes.postTextToSpeechGenerate;
