import { signHmacSha256Hex } from '@/shared/lib/runtime/crypto';

export const TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE = 'tts_turnstile';
export const TEXT_TO_SPEECH_TURNSTILE_TRUST_MAX_AGE_SECONDS = 60 * 30;

const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

type TurnstileTrust = {
  anonymousSessionId: string;
  expiresAt: number;
};

export type TextToSpeechTurnstileTrustLimiter = {
  acquire: (key: string) => Promise<{ allowed: boolean }>;
  clear: (key: string) => Promise<void>;
};

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) {
      continue;
    }
    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  }

  return cookies;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function isSecureRequest(req: Request): boolean {
  return (
    new URL(req.url).protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https'
  );
}

function serializeTrustCookie({
  value,
  maxAge,
  secure,
}: {
  value: string;
  maxAge: number;
  secure: boolean;
}) {
  return [
    `${TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export async function buildTextToSpeechTurnstileTrustCookie({
  anonymousSessionId,
  expiresAt,
  secret,
}: TurnstileTrust & {
  secret: string;
}) {
  const payload = `${anonymousSessionId}.${expiresAt}`;
  const signature = await signHmacSha256Hex(payload, secret);
  return `${payload}.${signature}`;
}

export async function readTextToSpeechTurnstileTrustCookie({
  req,
  anonymousSessionId,
  secret,
  now,
}: {
  req: Request;
  anonymousSessionId: string;
  secret: string;
  now: () => number;
}): Promise<TurnstileTrust | null> {
  const cookieValue = parseCookieHeader(req.headers.get('cookie')).get(
    TEXT_TO_SPEECH_TURNSTILE_TRUST_COOKIE
  );
  const [cookieAnonymousSessionId, expiresRaw, signature, extra] =
    cookieValue?.split('.') ?? [];
  const expiresAt = Number(expiresRaw);

  if (
    extra !== undefined ||
    cookieAnonymousSessionId !== anonymousSessionId ||
    !Number.isInteger(expiresAt) ||
    expiresAt <= now() ||
    !signature ||
    !SIGNATURE_PATTERN.test(signature)
  ) {
    return null;
  }

  const expected = await signHmacSha256Hex(
    `${cookieAnonymousSessionId}.${expiresAt}`,
    secret
  );
  if (!constantTimeEqual(expected, signature)) {
    return null;
  }

  return {
    anonymousSessionId: cookieAnonymousSessionId,
    expiresAt,
  };
}

export async function consumeTextToSpeechTurnstileTrust({
  limiter,
  anonymousSessionId,
}: {
  limiter: TextToSpeechTurnstileTrustLimiter;
  anonymousSessionId: string;
}) {
  const result = await limiter.acquire(anonymousSessionId);
  return result.allowed;
}

export async function resetTextToSpeechTurnstileTrust({
  limiter,
  anonymousSessionId,
}: {
  limiter: TextToSpeechTurnstileTrustLimiter;
  anonymousSessionId: string;
}) {
  await limiter.clear(anonymousSessionId);
  return consumeTextToSpeechTurnstileTrust({
    limiter,
    anonymousSessionId,
  });
}

export async function readAndConsumeTextToSpeechTurnstileTrust({
  req,
  anonymousSessionId,
  secret,
  now,
  limiter,
}: {
  req: Request;
  anonymousSessionId: string;
  secret: string;
  now: () => number;
  limiter: TextToSpeechTurnstileTrustLimiter;
}): Promise<boolean> {
  const trust = await readTextToSpeechTurnstileTrustCookie({
    req,
    anonymousSessionId,
    secret,
    now,
  });
  if (!trust) {
    return false;
  }

  return consumeTextToSpeechTurnstileTrust({
    limiter,
    anonymousSessionId: trust.anonymousSessionId,
  });
}

export async function createTextToSpeechTurnstileTrustCookie({
  req,
  anonymousSessionId,
  secret,
  now,
}: {
  req: Request;
  anonymousSessionId: string;
  secret: string;
  now: () => number;
}) {
  const expiresAt =
    now() + TEXT_TO_SPEECH_TURNSTILE_TRUST_MAX_AGE_SECONDS * 1000;

  return serializeTrustCookie({
    value: await buildTextToSpeechTurnstileTrustCookie({
      anonymousSessionId,
      expiresAt,
      secret,
    }),
    maxAge: TEXT_TO_SPEECH_TURNSTILE_TRUST_MAX_AGE_SECONDS,
    secure: isSecureRequest(req),
  });
}

export function clearTextToSpeechTurnstileTrustCookie(req: Request) {
  return serializeTrustCookie({
    value: '',
    maxAge: 0,
    secure: isSecureRequest(req),
  });
}
