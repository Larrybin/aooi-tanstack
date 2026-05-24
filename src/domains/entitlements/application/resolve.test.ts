import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseEntitlementsJson,
  parseProductEntitlementsJson,
  stringifyEntitlements,
  stringifyProductEntitlements,
} from '@/domains/entitlements/domain/entitlements';
import type { EntitlementGrantRecord } from '@/domains/entitlements/domain/types';

import { resolveEffectiveEntitlements } from './resolve';

const now = new Date('2026-05-21T00:00:00Z');

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
        entitlements: { monthly_removals: 50 },
      }),
    reason: overrides.reason ?? 'release smoke',
    grantedByUserId: overrides.grantedByUserId ?? null,
    startsAt: overrides.startsAt ?? new Date('2026-05-20T00:00:00Z'),
    expiresAt: overrides.expiresAt ?? new Date('2026-05-22T00:00:00Z'),
    revokedAt: overrides.revokedAt ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-05-20T00:00:00Z'),
  };
}

test('parseEntitlementsJson rejects invalid JSON and unsupported values', () => {
  assert.throws(() => parseEntitlementsJson('{'), /valid JSON/u);
  assert.throws(() => parseEntitlementsJson('[]'), /JSON object/u);
  assert.throws(
    () => parseEntitlementsJson('{"monthly_removals":null}'),
    /string, number, or boolean/u
  );
  assert.throws(
    () => parseEntitlementsJson('{"nested":{"value":1}}'),
    /string, number, or boolean/u
  );
});

test('parseProductEntitlementsJson rejects unknown entitlement keys for the product', () => {
  assert.throws(
    () =>
      parseProductEntitlementsJson({
        productKey: 'ai-remover',
        value: '{"bypassQuota":true}',
      }),
    /unknown entitlement bypassQuota/u
  );
  assert.throws(
    () =>
      parseProductEntitlementsJson({
        productKey: 'ai-remover',
        value: '{"monthly_removals":"50"}',
      }),
    /monthly_removals must be a number/u
  );
});

test('parseProductEntitlementsJson rejects AI Remover pricing-only keys for grants', () => {
  const pricingOnlyGrantKeys = {
    guest_daily_removals: 2,
    daily_removals: 5,
    retention_days: 7,
    advanced_mode: true,
    priority_queue: true,
  };

  for (const [key, value] of Object.entries(pricingOnlyGrantKeys)) {
    assert.throws(
      () =>
        parseProductEntitlementsJson({
          productKey: 'ai-remover',
          source: 'grant',
          value: JSON.stringify({ [key]: value }),
        }),
      new RegExp(`entitlement ${key} is not allowed for grant`, 'u')
    );
  }
});

test('resolveEffectiveEntitlements ignores expired, revoked, and wrong-environment grants', async () => {
  const result = await resolveEffectiveEntitlements({
    userId: 'user_1',
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    baseEntitlements: { daily_removals: 5 },
    environment: 'preview',
    internalEntitlementGrantsEnabled: false,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'expired',
          expiresAt: new Date('2026-05-20T23:59:59Z'),
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 100 },
          }),
        }),
        grant({
          id: 'revoked',
          revokedAt: new Date('2026-05-20T12:00:00Z'),
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 200 },
          }),
        }),
        grant({
          id: 'wrong-env',
          environment: 'staging',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: { monthly_removals: 300 },
          }),
        }),
      ],
    },
  });

  assert.deepEqual(result, {
    entitlements: { daily_removals: 5 },
    grantIds: [],
  });
});

test('resolveEffectiveEntitlements merges active grants without lowering base numeric entitlements', async () => {
  const result = await resolveEffectiveEntitlements({
    userId: 'user_1',
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    baseEntitlements: {
      monthly_removals: 500,
      monthly_high_res_downloads: 10,
      max_upload_mb: 25,
    },
    environment: 'preview',
    internalEntitlementGrantsEnabled: false,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'older',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              monthly_removals: 50,
              max_upload_mb: 20,
            },
          }),
          createdAt: new Date('2026-05-20T01:00:00Z'),
        }),
        grant({
          id: 'newer',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              monthly_high_res_downloads: 75,
              max_upload_mb: 30,
            },
          }),
          createdAt: new Date('2026-05-20T02:00:00Z'),
        }),
      ],
    },
  });

  assert.deepEqual(result, {
    entitlements: {
      monthly_removals: 500,
      monthly_high_res_downloads: 75,
      max_upload_mb: 30,
    },
    grantIds: ['older', 'newer'],
  });
});

test('resolveEffectiveEntitlements skips legacy pricing-only grant keys without failing access', async () => {
  const result = await resolveEffectiveEntitlements({
    userId: 'user_1',
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    baseEntitlements: {
      daily_removals: 5,
      advanced_mode: false,
      retention_days: 7,
      monthly_removals: 10,
    },
    environment: 'preview',
    internalEntitlementGrantsEnabled: false,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'legacy-pricing-only',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              daily_removals: 50,
              advanced_mode: true,
              retention_days: 30,
            },
          }),
        }),
        grant({
          id: 'legacy-mixed',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              monthly_removals: 75,
              priority_queue: true,
            },
          }),
        }),
      ],
    },
  });

  assert.deepEqual(result, {
    entitlements: {
      daily_removals: 5,
      advanced_mode: false,
      retention_days: 7,
      monthly_removals: 75,
    },
    grantIds: ['legacy-mixed'],
  });
});

test('resolveEffectiveEntitlements rejects active grants with unknown keys', async () => {
  await assert.rejects(
    () =>
      resolveEffectiveEntitlements({
        userId: 'user_1',
        siteKey: 'ai-remover',
        productKey: 'ai-remover',
        baseEntitlements: {},
        environment: 'preview',
        internalEntitlementGrantsEnabled: false,
        now,
        deps: {
          listGrants: async () => [
            grant({
              entitlementsJson: stringifyEntitlements({
                bypassQuota: true,
              }),
            }),
          ],
        },
      }),
    /unknown entitlement bypassQuota/u
  );
});

test('resolveEffectiveEntitlements still lets later grants raise numeric entitlements', async () => {
  const result = await resolveEffectiveEntitlements({
    userId: 'user_1',
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    baseEntitlements: {
      monthly_removals: 10,
    },
    environment: 'preview',
    internalEntitlementGrantsEnabled: false,
    now,
    deps: {
      listGrants: async () => [
        grant({
          id: 'older',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              monthly_removals: 50,
            },
          }),
          createdAt: new Date('2026-05-20T01:00:00Z'),
        }),
        grant({
          id: 'newer',
          entitlementsJson: stringifyProductEntitlements({
            productKey: 'ai-remover',
            entitlements: {
              monthly_removals: 75,
            },
          }),
          createdAt: new Date('2026-05-20T02:00:00Z'),
        }),
      ],
    },
  });

  assert.deepEqual(result, {
    entitlements: {
      monthly_removals: 75,
    },
    grantIds: ['older', 'newer'],
  });
});

test('resolveEffectiveEntitlements ignores production grants unless explicitly enabled', async () => {
  const deps = {
    listGrants: async () => [
      grant({
        id: 'production-grant',
        environment: 'production',
        entitlementsJson: stringifyProductEntitlements({
          productKey: 'ai-remover',
          entitlements: { monthly_removals: 50 },
        }),
      }),
    ],
  };
  const disabled = await resolveEffectiveEntitlements({
    userId: 'user_1',
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    baseEntitlements: { monthly_removals: 5 },
    environment: 'production',
    internalEntitlementGrantsEnabled: false,
    now,
    deps,
  });
  const enabled = await resolveEffectiveEntitlements({
    userId: 'user_1',
    siteKey: 'ai-remover',
    productKey: 'ai-remover',
    baseEntitlements: { monthly_removals: 5 },
    environment: 'production',
    internalEntitlementGrantsEnabled: true,
    now,
    deps,
  });

  assert.deepEqual(disabled, {
    entitlements: { monthly_removals: 5 },
    grantIds: [],
  });
  assert.deepEqual(enabled, {
    entitlements: { monthly_removals: 50 },
    grantIds: ['production-grant'],
  });
});
