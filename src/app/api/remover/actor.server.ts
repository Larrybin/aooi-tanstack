import 'server-only';

import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import {
  REMOVER_ANONYMOUS_SESSION_COOKIE,
  resolveAnonymousSessionForRequest,
} from '@/domains/remover/application/actor-session';
import type { RemoverActor } from '@/domains/remover/domain/types';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import { cookies } from 'next/headers';

import { assertCsrf } from '@/shared/lib/api/csrf.server';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';

const ANONYMOUS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getAnonymousSessionSecret(): string {
  return (
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    ''
  );
}

function isSecureRequest(req: Request): boolean {
  return (
    new URL(req.url).protocol === 'https:' ||
    req.headers.get('x-forwarded-proto') === 'https'
  );
}

export async function resolveRemoverActor(req: Request): Promise<RemoverActor> {
  assertCsrf(req);

  const secret = getAnonymousSessionSecret();
  if (!secret) {
    throw new ServiceUnavailableError(
      'anonymous remover session secret is not configured'
    );
  }

  const [user, anonymousSession] = await Promise.all([
    getSignedInUserIdentity(),
    resolveAnonymousSessionForRequest(req, { secret }),
  ]);
  if (anonymousSession.shouldSetCookie) {
    const cookieStore = await cookies();
    cookieStore.set({
      name: REMOVER_ANONYMOUS_SESSION_COOKIE,
      value: anonymousSession.cookieValue,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecureRequest(req),
      path: '/',
      maxAge: ANONYMOUS_SESSION_MAX_AGE_SECONDS,
    });
  }

  if (!user) {
    return {
      kind: 'anonymous',
      anonymousSessionId: anonymousSession.anonymousSessionId,
    };
  }

  const subscription = await getCurrentSubscription(user.id);
  return {
    kind: 'user',
    userId: user.id,
    anonymousSessionId: anonymousSession.anonymousSessionId,
    productId: subscription?.productId || 'free',
  };
}
