
import { createHash, timingSafeEqual } from 'crypto';
import { db } from '@/infra/adapters/db';
import { getServerRuntimeEnv } from '@/infra/runtime/env.server';
import { and, desc, eq, ne } from 'drizzle-orm';

import { verification } from '@/config/db/schema';
import { SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS } from '@/shared/constants/email';
import { normalizeEmail } from '@/shared/lib/email';
import { getUuid } from '@/shared/lib/hash';

export { SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS } from '@/shared/constants/email';

const IDENTIFIER_PREFIX = 'settings-email-verify';

function buildIdentifier(input: { userId: string; email: string }): string {
  return `${IDENTIFIER_PREFIX}:${input.userId}:${normalizeEmail(input.email)}`;
}

function hashCode(input: { identifier: string; code: string }): string {
  const { authSecret } = getServerRuntimeEnv();
  return createHash('sha256')
    .update(`${input.identifier}:${authSecret}:${input.code}`)
    .digest('hex');
}

function decodeHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);

    if (Number.isNaN(byte)) {
      return null;
    }

    bytes[index / 2] = byte;
  }

  return bytes;
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = decodeHex(aHex);
  const b = decodeHex(bHex);
  if (!a || !b) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export type PersistedEmailVerificationCode = {
  id: string;
  identifier: string;
  expiresAt: Date;
};

export async function persistSettingsEmailVerificationCode(input: {
  userId: string;
  email: string;
  code: string;
  ttlMs?: number;
}): Promise<PersistedEmailVerificationCode> {
  const identifier = buildIdentifier({
    userId: input.userId,
    email: input.email,
  });
  const id = getUuid();
  const expiresAt = new Date(
    Date.now() +
      (typeof input.ttlMs === 'number'
        ? input.ttlMs
        : SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS)
  );
  const value = hashCode({ identifier, code: input.code });

  await db().insert(verification).values({
    id,
    identifier,
    value,
    expiresAt,
  });

  return { id, identifier, expiresAt };
}

export async function deleteEmailVerificationCodeById(
  id: string
): Promise<void> {
  await db().delete(verification).where(eq(verification.id, id));
}

export async function deleteEmailVerificationCodesByIdentifierExceptId(input: {
  identifier: string;
  keepId: string;
}): Promise<void> {
  await db()
    .delete(verification)
    .where(
      and(
        eq(verification.identifier, input.identifier),
        ne(verification.id, input.keepId)
      )
    );
}

export type ConsumeEmailVerificationCodeResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'mismatch' };

export async function consumeSettingsEmailVerificationCode(input: {
  userId: string;
  email: string;
  code: string;
}): Promise<ConsumeEmailVerificationCodeResult> {
  const identifier = buildIdentifier({
    userId: input.userId,
    email: input.email,
  });

  const [record] = await db()
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .orderBy(desc(verification.createdAt))
    .limit(1);

  if (!record) {
    return { ok: false, reason: 'not_found' };
  }

  const now = new Date();
  if (record.expiresAt <= now) {
    await deleteEmailVerificationCodeById(record.id);
    return { ok: false, reason: 'expired' };
  }

  const expectedValue = hashCode({ identifier, code: input.code });
  const matches = timingSafeEqualHex(record.value, expectedValue);
  if (!matches) {
    return { ok: false, reason: 'mismatch' };
  }

  const [deleted] = await db()
    .delete(verification)
    .where(eq(verification.id, record.id))
    .returning();

  if (!deleted) {
    return { ok: false, reason: 'not_found' };
  }

  return { ok: true };
}
