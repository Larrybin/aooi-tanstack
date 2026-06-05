import assert from 'node:assert/strict';
import test from 'node:test';
import { stringifyProductEntitlements } from '@/domains/entitlements/domain/entitlements';
import type { EntitlementGrantRecord } from '@/domains/entitlements/domain/types';

import type { Pricing } from '@/shared/types/blocks/pricing';

import { resolveProductAccess } from './resolve-product-access';

const now = new Date('2026-05-21T00:00:00Z');
const pricing = {
  items: [
    {
      title: 'Free',
      interval: 'month',
      amount: 0,
      currency: 'USD',
      product_id: 'free',
      plan_name: 'Free',
      entitlements: {
        guest_daily_removals: 2,
        low_res_download: true,
        daily_removals: 5,
        signup_high_res_downloads: 3,
        retention_days: 7,
      },
    },
    {
      title: 'Pro',
      interval: 'month',
      amount: 999,
      currency: 'USD',
      product_id: 'pro-monthly',
      plan_name: 'Pro',
      entitlements: {
        monthly_removals: 500,
        monthly_high_res_downloads: 300,
        advanced_mode: true,
        max_upload_mb: 20,
        retention_days: 30,
      },
    },
  ],
} satisfies Pricing;

function grant(
  overrides: Partial<EntitlementGrantRecord> = {}
): EntitlementGrantRecord {
  return {
    id: overrides.id ?? 'grant_1',
    userId: overrides.userId ?? 'user_1',
    siteKey: overrides.siteKey ?? 'ai-remover',
    productKey: overrides.productKey ?? 'ai-remover',
    environment: overrides.environment ?? 'preview',
    source: overrides.source ?? 'internal_test',
    status: overrides.status ?? 'active',
    entitlementsJson:
      overrides.entitlementsJson ??
      stringifyProductEntitlements({
        productKey: 'ai-remover',
        entitlements: { monthly_removals: 750 },
        source: 'grant',
      }),
    reason: overrides.reason ?? 'test',
    grantedByUserId: overrides.grantedByUserId ?? null,
    startsAt: overrides.startsAt ?? new Date('2026-05-20T00:00:00Z'),
    expiresAt: overrides.expiresAt ?? new Date('2026-05-22T00:00:00Z'),
    revokedAt: overrides.revokedAt ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-05-20T00:00:00Z'),
  };
}

test('resolveProductAccess resolves guest actor default entitlements', async () => {
  const access = await resolveProductAccess({
    actor: {
      kind: 'anonymous',
      anonymousSessionId: 'anon_guest_123',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    environment: 'preview',
    pricing,
    now,
  });

  assert.equal(access.source, 'guest');
  assert.equal(access.productId, 'guest');
  assert.equal(access.planKey, 'Free');
  assert.equal(access.packageKey, 'free');
  assert.deepEqual(access.entitlements, pricing.items?.[0]?.entitlements);
  assert.deepEqual(access.entitlementGrantIds, []);
});

test('resolveProductAccess resolves signed-in subscription entitlements', async () => {
  const access = await resolveProductAccess({
    actor: {
      kind: 'user',
      userId: 'user_1',
      anonymousSessionId: 'anon_guest_123',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    environment: 'preview',
    pricing,
    now,
    deps: {
      getSubscriptionProductId: async () => 'pro-monthly',
      listGrants: async () => [],
    },
  });

  assert.equal(access.source, 'subscription');
  assert.equal(access.productId, 'pro-monthly');
  assert.equal(access.planKey, 'Pro');
  assert.equal(access.entitlements.monthly_removals, 500);
  assert.equal(access.entitlements.advanced_mode, true);
  assert.deepEqual(access.entitlementGrantIds, []);
});

test('resolveProductAccess merges active grants with existing entitlement priority', async () => {
  const access = await resolveProductAccess({
    actor: {
      kind: 'user',
      userId: 'user_1',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    environment: 'preview',
    pricing,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'lower',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 25 },
            source: 'grant',
          }),
          createdAt: new Date('2026-05-20T01:00:00Z'),
        }),
        grant({
          id: 'higher',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 50, max_upload_mb: 25 },
            source: 'grant',
          }),
          createdAt: new Date('2026-05-20T02:00:00Z'),
        }),
      ],
    },
  });

  assert.equal(access.source, 'grant');
  assert.equal(access.entitlements.daily_removals, 5);
  assert.equal(access.entitlements.monthly_removals, 50);
  assert.equal(access.entitlements.max_upload_mb, 25);
  assert.deepEqual(access.entitlementGrantIds, ['lower', 'higher']);
});

test('resolveProductAccess keeps access available when legacy grants include pricing-only keys', async () => {
  const access = await resolveProductAccess({
    actor: {
      kind: 'user',
      userId: 'user_1',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    environment: 'preview',
    pricing,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'legacy',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              daily_removals: 50,
              advanced_mode: true,
              monthly_removals: 75,
            },
          }),
        }),
      ],
    },
  });

  assert.equal(access.source, 'grant');
  assert.equal(access.entitlements.daily_removals, 5);
  assert.equal(access.entitlements.advanced_mode, undefined);
  assert.equal(access.entitlements.monthly_removals, 75);
  assert.deepEqual(access.entitlementGrantIds, ['legacy']);
});

test('resolveProductAccess keeps internal production grants disabled by default', async () => {
  let listedGrants = false;
  const access = await resolveProductAccess({
    actor: {
      kind: 'user',
      userId: 'user_1',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    environment: 'production',
    pricing,
    now,
    deps: {
      listGrants: async () => {
        listedGrants = true;
        return [grant({ environment: 'production' })];
      },
    },
  });

  assert.equal(listedGrants, true);
  assert.equal(access.source, 'default');
  assert.equal(access.entitlements.monthly_removals, undefined);
  assert.deepEqual(access.entitlementGrantIds, []);
});

test('resolveProductAccess applies billing grants in production', async () => {
  const access = await resolveProductAccess({
    actor: {
      kind: 'user',
      userId: 'user_1',
    },
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    productId: 'free',
    environment: 'production',
    pricing,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'manual',
          environment: 'production',
          source: 'internal_test',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 25 },
            source: 'grant',
          }),
        }),
        grant({
          id: 'billing',
          environment: 'production',
          source: 'billing',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 500 },
            source: 'grant',
          }),
        }),
      ],
    },
  });

  assert.equal(access.source, 'grant');
  assert.equal(access.entitlements.monthly_removals, 500);
  assert.deepEqual(access.entitlementGrantIds, ['billing']);
});

test('resolveProductAccess rejects unknown pricing entitlement keys', async () => {
  await assert.rejects(
    () =>
      resolveProductAccess({
        actor: {
          kind: 'user',
          userId: 'user_1',
        },
        siteKey: 'ai-remover',
        productKey: 'ai-remover',
        productId: 'free',
        environment: 'preview',
        pricing: {
          items: [
            {
              title: 'Free',
              interval: 'month',
              amount: 0,
              currency: 'USD',
              product_id: 'free',
              entitlements: {
                typo_monthly_removal: 10,
              },
            },
          ],
        },
        now,
      }),
    /unknown entitlement typo_monthly_removal/u
  );
});
