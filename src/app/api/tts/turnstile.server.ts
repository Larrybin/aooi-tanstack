import 'server-only';

import {
  createTextToSpeechTurnstileTrustCookie,
  readAndConsumeTextToSpeechTurnstileTrust,
  resetTextToSpeechTurnstileTrust,
  type TextToSpeechTurnstileTrustLimiter,
} from '@/domains/text-to-speech-generator/application/turnstile-trust';
import type { TextToSpeechActor } from '@/domains/text-to-speech-generator/domain/types';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import {
  BadRequestError,
  ServiceUnavailableError,
  UpstreamError,
} from '@/shared/lib/api/errors';

type TurnstileVerifyResponse = {
  success?: boolean;
};

function isProductionAppEnvironment() {
  const appEnvironment = getRuntimeEnvString('APP_ENVIRONMENT')?.trim();
  const nodeEnv = getRuntimeEnvString('NODE_ENV')?.trim();
  return appEnvironment === 'production' || nodeEnv === 'production';
}

export async function verifyTextToSpeechTurnstile({
  actor,
  token,
  req,
  remoteIp,
  trustLimiter,
  fetchFn = fetch,
  now = Date.now,
}: {
  actor: TextToSpeechActor;
  token?: string;
  req: Request;
  remoteIp?: string;
  trustLimiter: TextToSpeechTurnstileTrustLimiter;
  fetchFn?: typeof fetch;
  now?: () => number;
}) {
  if (actor.kind !== 'anonymous') {
    return;
  }

  const secret = getRuntimeEnvString('TURNSTILE_SECRET_KEY')?.trim() || '';
  if (!secret) {
    if (isProductionAppEnvironment()) {
      throw new ServiceUnavailableError(
        'text to speech verification is not configured'
      );
    }
    return;
  }

  const trusted = await readAndConsumeTextToSpeechTurnstileTrust({
    req,
    anonymousSessionId: actor.anonymousSessionId,
    secret,
    now,
    limiter: trustLimiter,
  });
  if (trusted) {
    return;
  }

  const trimmedToken = token?.trim();
  if (!trimmedToken) {
    throw new BadRequestError('turnstile verification is required');
  }

  const formData = new FormData();
  formData.set('secret', secret);
  formData.set('response', trimmedToken);
  if (remoteIp) {
    formData.set('remoteip', remoteIp);
  }

  const response = await fetchFn(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      body: formData,
    }
  );
  if (!response.ok) {
    throw new UpstreamError(502, 'turnstile verification failed');
  }

  const result = (await response.json()) as TurnstileVerifyResponse;
  if (!result.success) {
    throw new BadRequestError('turnstile verification failed');
  }

  await resetTextToSpeechTurnstileTrust({
    limiter: trustLimiter,
    anonymousSessionId: actor.anonymousSessionId,
  });

  return {
    setCookie: await createTextToSpeechTurnstileTrustCookie({
      req,
      anonymousSessionId: actor.anonymousSessionId,
      secret,
      now,
    }),
  };
}
