import type { ApiContext } from '@/app/api/_lib/context';
import {
  generateTextToSpeechPreview,
  TextToSpeechRequestError,
  type TextToSpeechProvider,
} from '@/domains/text-to-speech-generator/application/generate-preview';

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
  resolveActorKind: (req: Request) => Promise<'guest' | 'user'>;
  provider: TextToSpeechProvider;
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
    const actorKind = await deps.resolveActorKind(req);

    try {
      const result = await generateTextToSpeechPreview({
        input: { ...body, actorKind },
        provider: deps.provider,
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
    }
  };
}
