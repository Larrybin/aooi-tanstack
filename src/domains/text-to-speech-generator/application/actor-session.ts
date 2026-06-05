import {
  buildGuestSessionCookie,
  readGuestSession,
  resolveGuestSession,
  writeGuestSessionCookie,
  type GuestSessionResult,
} from '@/domains/product-access/application/guest-session.contracts';

export const TEXT_TO_SPEECH_ANONYMOUS_SESSION_COOKIE = 'tts_anon';
export const TEXT_TO_SPEECH_ANONYMOUS_SESSION_MAX_AGE_SECONDS =
  60 * 60 * 24 * 30;

type AnonymousSessionOptions = {
  secret?: string;
  createId?: () => string;
};

export async function buildTextToSpeechAnonymousSessionCookie({
  anonymousSessionId,
  secret,
}: {
  anonymousSessionId: string;
  secret: string;
}): Promise<string> {
  return buildGuestSessionCookie({ anonymousSessionId, secret });
}

export async function resolveTextToSpeechAnonymousSessionForRequest(
  req: Request,
  options: AnonymousSessionOptions = {}
) {
  return resolveGuestSession(req, {
    cookieName: TEXT_TO_SPEECH_ANONYMOUS_SESSION_COOKIE,
    secret: options.secret,
    createId: options.createId,
  });
}

export async function readTextToSpeechAnonymousSessionIdFromRequest(
  req: Request,
  options: Pick<AnonymousSessionOptions, 'secret'> = {}
): Promise<string | null> {
  const session = await readGuestSession(req, {
    cookieName: TEXT_TO_SPEECH_ANONYMOUS_SESSION_COOKIE,
    secret: options.secret,
  });
  return session?.anonymousSessionId ?? null;
}

export function writeTextToSpeechAnonymousSessionCookie({
  cookieStore,
  req,
  session,
}: {
  cookieStore: {
    set: Parameters<typeof writeGuestSessionCookie>[0]['cookieStore']['set'];
  };
  req: Request;
  session: GuestSessionResult;
}) {
  writeGuestSessionCookie({
    cookieStore,
    req,
    session,
    cookieName: TEXT_TO_SPEECH_ANONYMOUS_SESSION_COOKIE,
    maxAgeSeconds: TEXT_TO_SPEECH_ANONYMOUS_SESSION_MAX_AGE_SECONDS,
  });
}
