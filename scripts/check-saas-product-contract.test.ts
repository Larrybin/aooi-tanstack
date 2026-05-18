import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'check-saas-product-contract.mjs'
);

async function writeJson(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeText(filePath: string, value: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, 'utf8');
}

async function writeBillingSourceFiles(rootDir: string) {
  await writeText(
    path.join(rootDir, 'src/domains/billing/domain/payment.ts'),
    [
      'export enum PaymentEventType {',
      "  CHECKOUT_SUCCESS = 'checkout.success',",
      "  PAYMENT_SUCCESS = 'payment.success',",
      "  PAYMENT_FAILED = 'payment.failed',",
      "  PAYMENT_REFUNDED = 'payment.refunded',",
      "  SUBSCRIBE_UPDATED = 'subscribe.updated',",
      "  SUBSCRIBE_CANCELED = 'subscribe.canceled',",
      "  UNKNOWN = 'unknown',",
      '}',
      'export enum SubscriptionCycleType {',
      "  RENEWAL = 'renewal',",
      '}',
      'export enum SubscriptionStatus {',
      "  CANCELED = 'canceled',",
      "  EXPIRED = 'expired',",
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(
      rootDir,
      'src/domains/billing/application/process-payment-notify.ts'
    ),
    [
      "import { PaymentEventType, SubscriptionCycleType } from '../domain/payment';",
      'import { recordUnknownWebhookEvent } from "../infra/payment-webhook-audit";',
      'const PAYMENT_NOTIFY_EVENT_HANDLERS = {',
      '  [PaymentEventType.UNKNOWN]: handleUnknownEvent,',
      '  [PaymentEventType.CHECKOUT_SUCCESS]: handleCheckoutSuccessEvent,',
      '  [PaymentEventType.PAYMENT_SUCCESS]: handlePaymentSuccessEvent,',
      '  [PaymentEventType.SUBSCRIBE_UPDATED]: handleSubscriptionUpdatedEvent,',
      '  [PaymentEventType.SUBSCRIBE_CANCELED]: handleSubscriptionCanceledEvent,',
      '};',
      'function handleUnknownEvent() { recordUnknownWebhookEvent(); }',
      'function handleCheckoutSuccessEvent() {}',
      'function handlePaymentSuccessEvent(event) {',
      '  if (event.subscriptionCycleType === SubscriptionCycleType.RENEWAL) return;',
      '}',
      'function handleSubscriptionUpdatedEvent() {}',
      'function handleSubscriptionCanceledEvent() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/application/flows.ts'),
    [
      'export function handleCheckoutSuccess() {}',
      'export function handleSubscriptionUpdated() {}',
      'export function handleSubscriptionCanceled() {',
      '  const status = SubscriptionStatus.CANCELED;',
      '  const canceledEndAt = new Date();',
      '  return { status, canceledEndAt };',
      '}',
      'export function handleSubscriptionRenewal() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(
      rootDir,
      'src/domains/billing/application/payment-notify-flow.ts'
    ),
    [
      'export function isFinalizedInboxStatus() { return true; }',
      'export function markPaymentWebhookInboxProcessFailed() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(
      rootDir,
      'src/domains/billing/application/admin-payment-replay.ts'
    ),
    [
      'export const PaymentReplayActionSchema = { operationKind: true };',
      'export function executeAdminPaymentReplay() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/infra/payment-webhook-inbox.ts'),
    [
      'export const rawDigest = "rawDigest";',
      'export const insert = { onConflictDoNothing: true };',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(
      rootDir,
      'src/domains/billing/infra/payment-webhook-inbox.shared.ts'
    ),
    [
      'export const PAYMENT_WEBHOOK_OPERATION_KIND = {',
      "  COMPENSATION: 'compensation',",
      '};',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/infra/payment-webhook-audit.ts'),
    [
      'export function recordPaymentWebhookAudit() {}',
      'export function recordUnknownWebhookEvent() { recordPaymentWebhookAudit(); }',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/infra/order.ts'),
    [
      'export function updateOrderInTransaction() {}',
      'export function updateSubscriptionInTransaction() {}',
      'export function findOrderByTransactionId() {}',
      'export function findOrderByInvoiceId() {}',
      'export const lock = "pg_advisory_xact_lock";',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/infra/subscription.ts'),
    [
      'export function updateSubscriptionBySubscriptionNoIfNotCanceled() {}',
      'export function updateSubscriptionBySubscriptionNo() {}',
      'export const canceled = SubscriptionStatus.CANCELED;',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/domain/credit.ts'),
    [
      'export enum BillingCreditTransactionType {',
      "  GRANT = 'grant',",
      '}',
      'export enum BillingCreditTransactionScene {',
      "  RENEWAL = 'renewal',",
      '}',
      'export function buildGrantCreditForOrder() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'tests/contract/payment-notify.test.ts'),
    [
      'test("PAYMENT_FAILED fallback", () => {});',
      'test("renewal webhook", () => {});',
      '',
    ].join('\n')
  );
}

async function createFixtureRoot(pricing: unknown) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'saas-contract-audit-'));
  const siteKey = 'ai-remover';
  await writeJson(path.join(rootDir, 'sites', siteKey, 'site.config.json'), {
    key: siteKey,
    domain: 'airemover.example.com',
    brand: {
      appName: 'AI Remover',
      appUrl: 'https://airemover.example.com',
      supportEmail: 'support@airemover.example.com',
      logo: '/logo.png',
      favicon: '/favicon.ico',
      previewImage: '/logo.png',
    },
    capabilities: {
      auth: true,
      payment: 'creem',
      ai: true,
      docs: false,
      blog: false,
    },
    configVersion: 1,
  });
  await writeJson(
    path.join(rootDir, 'sites', siteKey, 'deploy.settings.json'),
    {
      configVersion: 1,
      bindingRequirements: {
        bindings: { workersAi: true },
        secrets: {
          authSharedSecret: true,
          googleOauth: true,
          githubOauth: false,
          removerCleanup: true,
        },
        vars: { storagePublicBaseUrl: true },
      },
      workers: {
        router: 'aooi-ai-remover-router',
        state: 'aooi-ai-remover-state',
        'public-web': 'aooi-ai-remover-public-web',
        auth: 'aooi-ai-remover-auth',
        payment: 'aooi-ai-remover-payment',
        member: 'aooi-ai-remover-member',
        chat: 'aooi-ai-remover-chat',
        admin: 'aooi-ai-remover-admin',
      },
      resources: {
        incrementalCacheBucket: 'aooi-ai-remover-opennext-cache',
        appStorageBucket: 'aooi-ai-remover-storage',
        hyperdriveId: '00000000000000000000000000000002',
      },
      state: { schemaVersion: 1 },
    }
  );
  await writeJson(
    path.join(rootDir, 'sites', siteKey, 'pricing.json'),
    pricing
  );
  await writeText(
    path.join(rootDir, 'src/domains/settings/definitions/payment.ts'),
    "export const paymentSettings = [{ name: 'creem_product_ids' }];\n"
  );
  await writeText(
    path.join(rootDir, 'src/config/env-contract.ts'),
    [
      'export const SERVER_RUNTIME_ENV_KEYS = [',
      "  'CREEM_API_KEY',",
      "  'CREEM_SIGNING_SECRET',",
      "  'BETTER_AUTH_SECRET',",
      "  'AUTH_SECRET',",
      "  'GOOGLE_CLIENT_ID',",
      "  'GOOGLE_CLIENT_SECRET',",
      "  'GITHUB_CLIENT_ID',",
      "  'GITHUB_CLIENT_SECRET',",
      "  'STORAGE_PUBLIC_BASE_URL',",
      "  'REMOVER_CLEANUP_SECRET',",
      '];',
      '',
    ].join('\n')
  );
  await writeBillingSourceFiles(rootDir);
  return rootDir;
}

function runAudit(rootDir: string) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: rootDir,
    env: {
      ...process.env,
      SITE: 'ai-remover',
    },
    encoding: 'utf8',
  });
}

test('contract audit warnings include source refs', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            raw_daily_limit: 2,
            low_res_download: true,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /warning  Raw entitlement key raw_daily_limit/);
  assert.match(
    result.stdout,
    /source  pricing:sites\/ai-remover\/pricing\.json:entitlements\.raw_daily_limit/
  );
});

test('contract audit converts pricing validation errors into source-mapped blockers', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          product_id: 'pro-monthly',
          interval: 'month',
          amount: '999',
          currency: 'USD',
          checkout_enabled: true,
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /SaaS Contract Audit/);
  assert.match(result.stdout, /Pricing file: invalid/);
  assert.match(
    result.stdout,
    /blocker  Pricing file could not be read or validated:/
  );
  assert.match(
    result.stdout,
    /source  pricing:sites\/ai-remover\/pricing\.json/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});

test('contract audit converts deploy settings validation errors into source-mapped blockers', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeJson(
    path.join(rootDir, 'sites', 'ai-remover', 'deploy.settings.json'),
    { configVersion: 1 }
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /SaaS Contract Audit/);
  assert.match(
    result.stdout,
    /blocker  Deploy settings could not be read or validated:/
  );
  assert.match(
    result.stdout,
    /source  deploy_settings:sites\/ai-remover\/deploy\.settings\.json/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});

test('contract audit detects creem product mapping setting structurally', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Pro',
          product_id: 'pro-monthly',
          interval: 'month',
          amount: 999,
          currency: 'USD',
          checkout_enabled: true,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeText(
    path.join(rootDir, 'src/domains/settings/definitions/payment.ts'),
    [
      'export const paymentSettings = [',
      '  {',
      '    name : "creem_product_ids",',
      '  },',
      '];',
      '',
    ].join('\n')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /payment provider product mapping: runtime_owned/
  );
  assert.doesNotMatch(
    result.stdout,
    /Paid checkout plan pro-monthly has no payment product mapping path/
  );
});

test('contract audit validates payment secret ownership from env contract sources', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeText(
    path.join(rootDir, 'src/config/env-contract.ts'),
    [
      'export const SERVER_RUNTIME_ENV_KEYS = [',
      "  'BETTER_AUTH_SECRET',",
      "  'AUTH_SECRET',",
      "  'GOOGLE_CLIENT_ID',",
      "  'GOOGLE_CLIENT_SECRET',",
      "  'STORAGE_PUBLIC_BASE_URL',",
      "  'REMOVER_CLEANUP_SECRET',",
      '];',
      '',
    ].join('\n')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /payment provider secrets: missing/);
  assert.match(
    result.stdout,
    /warning  Runtime-owned field payment provider secrets has no configured owner/
  );
  assert.match(
    result.stdout,
    /source  runtime_env:src\/config\/env-contract\.ts:CREEM_API_KEY/
  );
  assert.match(
    result.stdout,
    /source  runtime_env:src\/config\/env-contract\.ts:CREEM_SIGNING_SECRET/
  );
});

test('contract audit converts site config validation errors into source-mapped blockers', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await writeJson(
    path.join(rootDir, 'sites', 'ai-remover', 'site.config.json'),
    {
      key: 'ai-remover',
      domain: 'airemover.example.com',
      brand: {
        appName: 'AI Remover',
        appUrl: 'https://airemover.example.com',
        supportEmail: 'support@airemover.example.com',
        favicon: '/favicon.ico',
        previewImage: '/logo.png',
      },
      capabilities: {
        auth: true,
        payment: 'creem',
        ai: true,
        docs: false,
        blog: false,
      },
      configVersion: 1,
    }
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /SaaS Contract Audit/);
  assert.match(result.stdout, /Site section: partial/);
  assert.match(
    result.stdout,
    /blocker  Site config could not be read or validated:/
  );
  assert.match(
    result.stdout,
    /source  site_config:sites\/ai-remover\/site\.config\.json/
  );
  assert.match(result.stdout, /blocker  Missing site brand.logo/);
  assert.match(
    result.stdout,
    /source  site_config:sites\/ai-remover\/site\.config\.json:brand\.logo/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});

test('contract audit prints billing reversal event report', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Billing reversal:/);
  assert.match(result.stdout, /checkout\.success: handled/);
  assert.match(result.stdout, /payment\.refunded: unsupported/);
  assert.match(result.stdout, /manual compensation: partially_handled/);
});

test('contract audit reports missing payment failed and refunded handlers with sources', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /warning  payment\.failed is canonical/);
  assert.match(
    result.stdout,
    /source  billing_domain:src\/domains\/billing\/domain\/payment\.ts:PaymentEventType\.PAYMENT_FAILED/
  );
  assert.match(result.stdout, /warning  payment\.refunded is canonical/);
  assert.match(
    result.stdout,
    /source  billing_application:src\/domains\/billing\/application\/process-payment-notify\.ts:PAYMENT_NOTIFY_EVENT_HANDLERS/
  );
});

test('contract audit maps renewal to payment success with renewal cycle type', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /subscription\.renewed: handled \(payment\.success \+ SubscriptionCycleType\.RENEWAL\)/
  );
  assert.match(
    result.stdout,
    /source  billing_domain:src\/domains\/billing\/domain\/payment\.ts:SubscriptionCycleType\.RENEWAL/
  );
});

test('contract audit degrades missing billing source files into source-mapped warnings', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Free',
          product_id: 'free',
          interval: 'month',
          amount: 0,
          currency: 'USD',
          checkout_enabled: false,
          entitlements: {
            low_res_download: true,
          },
        },
      ],
    },
  });
  await rm(
    path.join(
      rootDir,
      'src/domains/billing/application/process-payment-notify.ts'
    )
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /warning  Billing reversal audit source is missing: payment notify process/
  );
  assert.match(
    result.stdout,
    /source  billing_application:src\/domains\/billing\/application\/process-payment-notify\.ts/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});
