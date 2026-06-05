import type { ApiContext } from '@/app/api/_lib/context';
import {
  TextToSpeechRequestError,
  type TextToSpeechProvider,
} from '@/domains/text-to-speech-generator/application/generate-preview';
import { generateStoredTextToSpeechPreview } from '@/domains/text-to-speech-generator/application/generation-workflow';
import type { TextToSpeechActor } from '@/domains/text-to-speech-generator/domain/types';
import type { getStorageService } from '@/infra/adapters/storage/service';

import {
  ApiError,
  BadRequestError,
  PayloadTooLargeError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { TextToSpeechGenerateBodySchema } from '@/shared/schemas/api/text-to-speech';

type TextToSpeechGenerateActionDeps = {
  createApiContext: (req: Request) => Pick<ApiContext, 'parseJson' | 'log'>;
  resolveActor: (req: Request) => Promise<TextToSpeechActor>;
  provider: TextToSpeechProvider;
  getStorageService: typeof getStorageService;
  findReusableGeneration: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['findReusableGeneration'];
  createGeneration: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['createGeneration'];
  markGenerationDeleted: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['markGenerationDeleted'];
  deleteOverflowGenerations: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['deleteOverflowGenerations'];
  countMonthlyQuotaUnits: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['countMonthlyQuotaUnits'];
  reserveMonthlyQuota: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['reserveMonthlyQuota'];
  commitMonthlyQuota: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['commitMonthlyQuota'];
  refundMonthlyQuota: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['refundMonthlyQuota'];
  consumeCredits: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['consumeCredits'];
  refundConsumedCredit: Parameters<
    typeof generateStoredTextToSpeechPreview
  >[0]['deps']['refundConsumedCredit'];
  verifyTurnstile?: (input: {
    actor: TextToSpeechActor;
    token?: string;
    req: Request;
  }) => Promise<void>;
  acquireGuestIpLimit?: (input: {
    actor: TextToSpeechActor;
    req: Request;
  }) => Promise<(() => Promise<void>) | undefined>;
};

function mapRequestError(error: TextToSpeechRequestError) {
  if (error.code === 'text_too_long') {
    return new PayloadTooLargeError(error.message, error.data);
  }

  return new BadRequestError(error.message, { code: error.code });
}

export function createTextToSpeechGeneratePostAction(
  deps: TextToSpeechGenerateActionDeps
) {
  return async (req: Request) => {
    const api = deps.createApiContext(req);
    const body = await api.parseJson(TextToSpeechGenerateBodySchema);
    const actor = await deps.resolveActor(req);
    await deps.verifyTurnstile?.({
      actor,
      token: body.turnstileToken,
      req,
    });
    const releaseGuestIpLimit = await deps.acquireGuestIpLimit?.({
      actor,
      req,
    });

    try {
      const result = await generateStoredTextToSpeechPreview({
        actor,
        input: body,
        deps: {
          provider: deps.provider,
          getStorageService: () => deps.getStorageService(),
          findReusableGeneration: deps.findReusableGeneration,
          createGeneration: deps.createGeneration,
          markGenerationDeleted: deps.markGenerationDeleted,
          deleteOverflowGenerations: deps.deleteOverflowGenerations,
          countMonthlyQuotaUnits: deps.countMonthlyQuotaUnits,
          reserveMonthlyQuota: deps.reserveMonthlyQuota,
          commitMonthlyQuota: deps.commitMonthlyQuota,
          refundMonthlyQuota: deps.refundMonthlyQuota,
          consumeCredits: deps.consumeCredits,
          refundConsumedCredit: deps.refundConsumedCredit,
        },
      });
      return jsonOk(result, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
      if (error instanceof TextToSpeechRequestError) {
        throw mapRequestError(error);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      api.log.error('tts: preview generation failed', { error });
      throw new UpstreamError(502, 'text to speech generation failed');
    } finally {
      await releaseGuestIpLimit?.().catch(() => undefined);
    }
  };
}
