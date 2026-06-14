import { getCurrentSubscription } from '@/domains/billing/infra/subscription';
import { resolveAppEnvironment } from '@/domains/entitlements/domain/types';
import { listActiveEntitlementGrantsForScope } from '@/domains/entitlements/infra/grant';
import { resolveProductAccess } from '@/domains/product-entitlements/application/resolve-product-access';
import {
  REMOVER_ANONYMOUS_SESSION_COOKIE,
  REMOVER_ANONYMOUS_SESSION_MAX_AGE_SECONDS,
  resolveAnonymousSessionForRequest,
  writeAnonymousSessionCookie,
} from '@/domains/remover/application/actor-session';
import type { RemoverActor } from '@/domains/remover/domain/types';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import {
  getRuntimeEnvString,
  isRuntimeEnvEnabled,
} from '@/infra/runtime/env.server';
import { site, sitePricing } from '@/site';

import { assertCsrf } from '@/shared/lib/api/csrf.server';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';

type SetCookieSink = {
  appendSetCookie(value: string): void;
};

function getAnonymousSessionSecret(): string {
  return (
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    ''
  );
}

function resolveEntitlementEnvironment() {
  return resolveAppEnvironment({
    configured: getRuntimeEnvString('APP_ENVIRONMENT'),
    nodeEnv: getRuntimeEnvString('NODE_ENV'),
  });
}

function serializeCookie(input: {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}) {
  return [
    `${input.name}=${encodeURIComponent(input.value)}`,
    `Max-Age=${input.maxAge}`,
    `Path=${input.path}`,
    'HttpOnly',
    `SameSite=${input.sameSite[0]!.toUpperCase()}${input.sameSite.slice(1)}`,
    input.secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function writeAnonymousSessionSetCookie({
  req,
  session,
  sink,
}: {
  req: Request;
  session: Parameters<typeof writeAnonymousSessionCookie>[0]['session'];
  sink?: SetCookieSink;
}) {
  if (!sink) {
    return;
  }

  writeAnonymousSessionCookie({
    req,
    session,
    cookieStore: {
      set: (cookie) => {
        if (cookie.name !== REMOVER_ANONYMOUS_SESSION_COOKIE) {
          return;
        }
        sink.appendSetCookie(
          serializeCookie({
            ...cookie,
            maxAge: REMOVER_ANONYMOUS_SESSION_MAX_AGE_SECONDS,
          })
        );
      },
    },
  });
}

export async function resolveRemoverActorFromRequest(
  req: Request,
  sink?: SetCookieSink
): Promise<RemoverActor> {
  assertCsrf(req);

  const secret = getAnonymousSessionSecret();
  if (!secret) {
    throw new ServiceUnavailableError(
      'anonymous remover session secret is not configured'
    );
  }

  const [user, anonymousSession] = await Promise.all([
    getSignedInUserIdentityFromRequest(req),
    resolveAnonymousSessionForRequest(req, { secret }),
  ]);
  writeAnonymousSessionSetCookie({ req, session: anonymousSession, sink });

  if (!user) {
    const actor = {
      kind: 'anonymous',
      anonymousSessionId: anonymousSession.anonymousSessionId,
    } satisfies RemoverActor;
    const productAccess = await resolveProductAccess({
      actor,
      siteKey: site.key,
      productKey: site.key,
      productId: 'free',
      environment: resolveEntitlementEnvironment(),
      pricing: sitePricing?.pricing,
    });

    return {
      ...actor,
      productAccess,
    };
  }

  const actor = {
    kind: 'user',
    userId: user.id,
    anonymousSessionId: anonymousSession.anonymousSessionId,
  } satisfies RemoverActor;
  const productAccess = await resolveProductAccess({
    actor,
    siteKey: site.key,
    productKey: site.key,
    productId: 'free',
    environment: resolveEntitlementEnvironment(),
    pricing: sitePricing?.pricing,
    internalEntitlementGrantsEnabled: isRuntimeEnvEnabled(
      'INTERNAL_ENTITLEMENT_GRANTS_ENABLED'
    ),
    deps: {
      getSubscriptionProductId: async (userId) =>
        (await getCurrentSubscription(userId))?.productId,
      listGrants: listActiveEntitlementGrantsForScope,
    },
  });

  return {
    ...actor,
    productId: productAccess.productId,
    entitlements: productAccess.entitlements,
    entitlementGrantIds: productAccess.entitlementGrantIds,
    productAccess,
  };
}

export async function resolveRemoverActor(
  req: Request,
  sink?: SetCookieSink
): Promise<RemoverActor> {
  return resolveRemoverActorFromRequest(req, sink);
}
