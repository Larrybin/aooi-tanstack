
import { headers } from 'next/headers';
import { db } from '@/infra/adapters/db';
import { createRequestScopedAuthSessionReader } from '@/infra/platform/auth/session-reader';
import { and, eq, gt } from 'drizzle-orm';

import { session, user } from '@/config/db/schema';
import type {
  AuthSessionUserIdentity,
  AuthSessionUserSnapshot,
} from '@/shared/types/auth-session';

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

const requestScopedAuthSessionReader = createRequestScopedAuthSessionReader(
  readSignedInUserIdentityBySessionToken
);

export async function getSignedInUserIdentity(): Promise<AuthSessionUserIdentity | null> {
  return requestScopedAuthSessionReader.getIdentity(
    (await headers()).get('cookie')
  );
}

export async function getSignedInUserSnapshot(): Promise<AuthSessionUserSnapshot | null> {
  return requestScopedAuthSessionReader.getSnapshot(
    (await headers()).get('cookie')
  );
}
