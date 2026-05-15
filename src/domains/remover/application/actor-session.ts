import { signHmacSha256Hex } from '@/shared/lib/runtime/crypto';

export const REMOVER_ANONYMOUS_SESSION_COOKIE = 'remover_anon';

const ANONYMOUS_SESSION_PATTERN = /^anon_[A-Za-z0-9_-]{8,80}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

type AnonymousSessionOptions = {
  secret?: string;
  createId?: () => string;
};

type AnonymousSessionResult = {
  anonymousSessionId: string;
  cookieValue: string;
  shouldSetCookie: boolean;
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
    if (name) {
      try {
        cookies.set(name, decodeURIComponent(value));
      } catch {
        cookies.set(name, value);
      }
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

function createAnonymousSessionId(createId?: () => string): string {
  const id = createId?.() ?? `anon_${crypto.randomUUID().replaceAll('-', '')}`;
  if (!ANONYMOUS_SESSION_PATTERN.test(id)) {
    throw new Error('invalid anonymous remover session id');
  }
  return id;
}

export async function buildAnonymousSessionCookie({
  anonymousSessionId,
  secret,
}: {
  anonymousSessionId: string;
  secret: string;
}): Promise<string> {
  if (!secret) {
    throw new Error('anonymous remover session secret is not configured');
  }
  if (!ANONYMOUS_SESSION_PATTERN.test(anonymousSessionId)) {
    throw new Error('invalid anonymous remover session id');
  }

  const signature = await signHmacSha256Hex(anonymousSessionId, secret);
  return `${anonymousSessionId}.${signature}`;
}

async function verifyAnonymousSessionCookie({
  cookieValue,
  secret,
}: {
  cookieValue: string | undefined;
  secret: string;
}): Promise<string | null> {
  const [anonymousSessionId, signature, extra] = cookieValue?.split('.') ?? [];
  if (
    extra !== undefined ||
    !anonymousSessionId ||
    !signature ||
    !ANONYMOUS_SESSION_PATTERN.test(anonymousSessionId) ||
    !SIGNATURE_PATTERN.test(signature)
  ) {
    return null;
  }

  const expected = await signHmacSha256Hex(anonymousSessionId, secret);
  return constantTimeEqual(expected, signature) ? anonymousSessionId : null;
}

export async function resolveAnonymousSessionForRequest(
  req: Request,
  options: AnonymousSessionOptions = {}
): Promise<AnonymousSessionResult> {
  const secret = options.secret?.trim() || '';
  if (!secret) {
    throw new Error('anonymous remover session secret is not configured');
  }

  const cookieValue = parseCookieHeader(req.headers.get('cookie')).get(
    REMOVER_ANONYMOUS_SESSION_COOKIE
  );
  const verifiedSessionId = await verifyAnonymousSessionCookie({
    cookieValue,
    secret,
  });
  if (verifiedSessionId) {
    return {
      anonymousSessionId: verifiedSessionId,
      cookieValue: cookieValue ?? '',
      shouldSetCookie: false,
    };
  }

  const anonymousSessionId = createAnonymousSessionId(options.createId);
  return {
    anonymousSessionId,
    cookieValue: await buildAnonymousSessionCookie({
      anonymousSessionId,
      secret,
    }),
    shouldSetCookie: true,
  };
}

export async function readAnonymousSessionIdFromRequest(
  req: Request,
  options: Pick<AnonymousSessionOptions, 'secret'> = {}
): Promise<string | null> {
  const secret = options.secret?.trim() || '';
  if (!secret) {
    return null;
  }

  const cookieValue = parseCookieHeader(req.headers.get('cookie')).get(
    REMOVER_ANONYMOUS_SESSION_COOKIE
  );
  return verifyAnonymousSessionCookie({
    cookieValue,
    secret,
  });
}

export async function resolveAnonymousSessionIdForRequest(
  req: Request,
  options: AnonymousSessionOptions = {}
): Promise<string> {
  const session = await resolveAnonymousSessionForRequest(req, options);
  return session.anonymousSessionId;
}
