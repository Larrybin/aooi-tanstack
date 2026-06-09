import { db } from '@/infra/adapters/db';
import { readSignedInUserIdentityFromCookieHeader } from '@/infra/platform/auth/session-reader';
import { and, eq, gt } from 'drizzle-orm';

import { session, user } from '@/config/db/schema';
import type { AuthSessionUserIdentity } from '@/shared/types/auth-session';

async function readSignedInUserIdentityBySessionToken(
  sessionToken: string
): Promise<AuthSessionUserIdentity | null> {
  const [signedInUser] = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(
      and(eq(session.token, sessionToken), gt(session.expiresAt, new Date()))
    )
    .limit(1);

  return signedInUser ?? null;
}

export async function getSignedInUserIdentityFromRequest(
  request: Request
): Promise<AuthSessionUserIdentity | null> {
  return readSignedInUserIdentityFromCookieHeader(
    request.headers.get('cookie'),
    readSignedInUserIdentityBySessionToken
  );
}
