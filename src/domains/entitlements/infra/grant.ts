
import { db } from '@/infra/adapters/db';
import { and, asc, eq } from 'drizzle-orm';

import { entitlementGrant } from '@/config/db/schema';

export type EntitlementGrant = typeof entitlementGrant.$inferSelect;
export type NewEntitlementGrant = typeof entitlementGrant.$inferInsert;

export async function listActiveEntitlementGrantsForScope({
  userId,
  siteKey,
  productKey,
}: {
  userId: string;
  siteKey: string;
  productKey: string;
}) {
  return await db()
    .select()
    .from(entitlementGrant)
    .where(
      and(
        eq(entitlementGrant.userId, userId),
        eq(entitlementGrant.siteKey, siteKey),
        eq(entitlementGrant.productKey, productKey),
        eq(entitlementGrant.status, 'active')
      )
    )
    .orderBy(asc(entitlementGrant.createdAt));
}
