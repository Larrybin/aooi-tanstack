import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { resolveBackgroundRemoverPlanLimits } from './plan';
import type { BackgroundRemoverActor } from './types';

function readBackgroundRemoverPlanEntitlements(
  productId: string
): Record<string, string | number | boolean> {
  const pricing = JSON.parse(
    readFileSync(
      path.join(process.cwd(), 'sites', 'background-remover', 'pricing.json'),
      'utf8'
    )
  ) as {
    pricing?: {
      items?: Array<{
        product_id?: string;
        entitlements?: Record<string, string | number | boolean>;
      }>;
    };
  };
  const item = pricing.pricing?.items?.find(
    (entry) => entry.product_id === productId
  );

  assert.ok(item, `missing background-remover pricing item: ${productId}`);
  return item.entitlements ?? {};
}

function createBackgroundRemoverUserActor(
  productId: string
): BackgroundRemoverActor {
  return {
    kind: 'user',
    userId: 'user_1',
    productAccess: {
      actor: { kind: 'user', userId: 'user_1' },
      siteKey: 'background-remover',
      productKey: 'background-remover',
      productId,
      environment: 'local',
      source: productId === 'free' ? 'free' : 'subscription',
      planKey: productId,
      packageKey: productId,
      entitlements: readBackgroundRemoverPlanEntitlements(productId),
      entitlementGrantIds: [],
    },
  };
}

test('resolveBackgroundRemoverPlanLimits matches Background Remover pricing matrix', () => {
  const cases = [
    [
      'free',
      {
        productId: 'free',
        processingLimit: 5,
        processingWindow: 'day',
        maxUploadMb: 10,
        retentionDays: 7,
      },
    ],
    [
      'pro-monthly',
      {
        productId: 'pro-monthly',
        processingLimit: 500,
        processingWindow: 'month',
        maxUploadMb: 20,
        retentionDays: 30,
      },
    ],
    [
      'studio-monthly',
      {
        productId: 'studio-monthly',
        processingLimit: 2000,
        processingWindow: 'month',
        maxUploadMb: 20,
        retentionDays: 30,
      },
    ],
  ] as const;

  for (const [productId, expected] of cases) {
    assert.deepEqual(
      resolveBackgroundRemoverPlanLimits(
        createBackgroundRemoverUserActor(productId)
      ),
      expected
    );
  }
});

test('resolveBackgroundRemoverPlanLimits uses guest daily defaults', () => {
  const limits = resolveBackgroundRemoverPlanLimits({
    kind: 'anonymous',
    anonymousSessionId: 'anon_1',
  });

  assert.deepEqual(limits, {
    productId: 'guest',
    processingLimit: 2,
    processingWindow: 'day',
    maxUploadMb: 10,
    retentionDays: 1,
  });
});

test('resolveBackgroundRemoverPlanLimits uses monthly paid entitlements', () => {
  const limits = resolveBackgroundRemoverPlanLimits({
    kind: 'user',
    userId: 'user_1',
    productAccess: {
      actor: { kind: 'user', userId: 'user_1' },
      siteKey: 'background-remover',
      productKey: 'background-remover',
      productId: 'pro-monthly',
      environment: 'local',
      source: 'subscription',
      planKey: 'Pro',
      packageKey: 'pro-monthly',
      entitlements: {
        monthly_removals: 500,
        max_upload_mb: 20,
        retention_days: 30,
      },
      entitlementGrantIds: [],
    },
  });

  assert.equal(limits.productId, 'pro-monthly');
  assert.equal(limits.processingLimit, 500);
  assert.equal(limits.processingWindow, 'month');
  assert.equal(limits.maxUploadMb, 20);
  assert.equal(limits.retentionDays, 30);
});
