import '@/config/load-dotenv';

import {
  parseProductEntitlementsJson,
  stringifyProductEntitlements,
} from '@/domains/entitlements/domain/entitlements';
import { isAppEnvironment } from '@/domains/entitlements/domain/types';
import { site } from '@/site';
import { and, desc, eq } from 'drizzle-orm';

import { entitlementGrant, user } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

import { createCliDb } from './lib/cli-db';

type ParsedArgs = {
  values: Record<string, string>;
  flags: Set<string>;
};

function parseArgs(args: string[]): ParsedArgs {
  const values: Record<string, string> = {};
  const flags = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      throw new Error(`unexpected argument: ${arg}`);
    }

    const assignmentIndex = arg.indexOf('=');
    if (assignmentIndex > 2) {
      values[arg.slice(2, assignmentIndex)] = arg.slice(assignmentIndex + 1);
      continue;
    }

    const name = arg.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith('--')) {
      values[name] = next;
      index += 1;
    } else {
      flags.add(name);
    }
  }

  return { values, flags };
}

function requiredArg(values: Record<string, string>, name: string) {
  const value = values[name]?.trim();
  if (!value) {
    throw new Error(`--${name} is required`);
  }
  return value;
}

function resolveExpiresAt({
  values,
  now,
}: {
  values: Record<string, string>;
  now: Date;
}) {
  const ttlHours = values['ttl-hours']?.trim();
  const expiresAtValue = values['expires-at']?.trim();

  if (ttlHours && expiresAtValue) {
    throw new Error('provide only one of --ttl-hours or --expires-at');
  }
  if (!ttlHours && !expiresAtValue) {
    throw new Error('--ttl-hours or --expires-at is required');
  }

  if (ttlHours) {
    const hours = Number(ttlHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error('--ttl-hours must be a positive number');
    }
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  const expiresAt = new Date(expiresAtValue as string);
  if (Number.isNaN(expiresAt.getTime())) {
    throw new Error('--expires-at must be a valid date');
  }
  if (expiresAt <= now) {
    throw new Error('--expires-at must be in the future');
  }
  return expiresAt;
}

async function main() {
  const { values, flags } = parseArgs(process.argv.slice(2));
  const email = requiredArg(values, 'email').toLowerCase();
  const siteKey = values['site-key']?.trim() || site.key;
  const productKey = requiredArg(values, 'product-key');
  const environment = requiredArg(values, 'environment');
  const source = values.source?.trim() || 'internal_test';
  const reason = requiredArg(values, 'reason');
  const entitlements = parseProductEntitlementsJson({
    productKey,
    value: requiredArg(values, 'entitlements'),
    source: 'grant',
  });
  const entitlementsJson = stringifyProductEntitlements({
    productKey,
    entitlements,
    source: 'grant',
  });
  const now = new Date();
  const expiresAt = resolveExpiresAt({ values, now });

  if (!isAppEnvironment(environment)) {
    throw new Error(
      '--environment must be one of local, preview, staging, production'
    );
  }
  if (environment === 'production' && !flags.has('allow-production')) {
    throw new Error('--allow-production is required for production grants');
  }

  const { db, close } = createCliDb();
  try {
    const [targetUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, email));
    if (!targetUser) {
      throw new Error(`user not found: ${email}`);
    }

    let grantedByUserId: string | null = null;
    const grantedByEmail = values['granted-by-email']?.trim().toLowerCase();
    if (grantedByEmail) {
      const [grantedByUser] = await db
        .select()
        .from(user)
        .where(eq(user.email, grantedByEmail));
      if (!grantedByUser) {
        throw new Error(`granted-by user not found: ${grantedByEmail}`);
      }
      grantedByUserId = grantedByUser.id;
    }

    const [existingGrant] = await db
      .select()
      .from(entitlementGrant)
      .where(
        and(
          eq(entitlementGrant.userId, targetUser.id),
          eq(entitlementGrant.siteKey, siteKey),
          eq(entitlementGrant.productKey, productKey),
          eq(entitlementGrant.environment, environment),
          eq(entitlementGrant.source, source),
          eq(entitlementGrant.status, 'active')
        )
      )
      .orderBy(desc(entitlementGrant.createdAt))
      .limit(1);

    const payload = {
      entitlementsJson,
      reason,
      grantedByUserId,
      startsAt: now,
      expiresAt,
      revokedAt: null,
      status: 'active',
      updatedAt: now,
    };

    let grantId: string;
    let updated = false;
    if (existingGrant) {
      grantId = existingGrant.id;
      updated = true;
      await db
        .update(entitlementGrant)
        .set(payload)
        .where(eq(entitlementGrant.id, existingGrant.id));
    } else {
      grantId = getUuid();
      await db.insert(entitlementGrant).values({
        id: grantId,
        userId: targetUser.id,
        siteKey,
        productKey,
        environment,
        source,
        createdAt: now,
        ...payload,
      });
    }

    process.stdout.write(
      JSON.stringify(
        {
          id: grantId,
          updated,
          email,
          siteKey,
          productKey,
          environment,
          source,
          expiresAt: expiresAt.toISOString(),
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
