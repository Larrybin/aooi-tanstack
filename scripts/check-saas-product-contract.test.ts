import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

async function updateJson(
  filePath: string,
  update: (value: Record<string, unknown>) => Record<string, unknown>
) {
  const current = JSON.parse(await readFile(filePath, 'utf8')) as Record<
    string,
    unknown
  >;
  await writeJson(filePath, update(current));
}

async function writeText(filePath: string, value: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, value, 'utf8');
}

const testSiteI18n = {
  defaultLocale: 'en',
  supportedLocales: ['en'],
  localePrefix: 'as-needed',
  localeDetection: false,
};

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

async function writeProviderSourceFiles(rootDir: string) {
  await writeText(
    path.join(rootDir, 'src/domains/remover/application/provider.ts'),
    [
      "export const CLOUDFLARE_WORKERS_AI_PROVIDER = 'cloudflare-workers-ai';",
      "export const DEFAULT_CLOUDFLARE_INPAINTING_MODEL = '@cf/runwayml/stable-diffusion-v1-5-inpainting';",
      'export function createAIProviderRemoverAdapter() {',
      '  return provider.generate({ params: { mediaType: AIMediaType.IMAGE, options: { image, mask } } });',
      '}',
      'export function createCloudflareWorkersAIRemoverAdapter({ ai, model }) {',
      '  return {',
      '    async submitTask({ inputImageUrl, maskImageUrl }) {',
      '      return ai.run(model, { image: inputImageUrl, mask: maskImageUrl });',
      '    },',
      '    async getTaskStatus() {',
      "      throw new ServiceUnavailableError('Workers AI remover tasks complete during submit');",
      '    },',
      '  };',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/remover/provider-adapter.server.ts'),
    [
      'import { getConfiguredAIService } from "@/domains/ai/application/service";',
      'import { CLOUDFLARE_WORKERS_AI_PROVIDER, DEFAULT_CLOUDFLARE_INPAINTING_MODEL } from "@/domains/remover/application/provider";',
      'import { getCloudflareAIBinding, getRuntimeEnvString } from "@/infra/runtime/env.server";',
      'export async function resolveRemoverProviderAdapter() {',
      "  const providerName = getRuntimeEnvString('REMOVER_AI_PROVIDER')?.trim() || CLOUDFLARE_WORKERS_AI_PROVIDER;",
      "  const configuredModel = getRuntimeEnvString('REMOVER_AI_MODEL')?.trim();",
      '  const model = configuredModel || (providerName === CLOUDFLARE_WORKERS_AI_PROVIDER ? DEFAULT_CLOUDFLARE_INPAINTING_MODEL : "");',
      '  const ai = getCloudflareAIBinding();',
      '  if (!ai) throw new ServiceUnavailableError("Cloudflare Workers AI is not bound");',
      '  return getConfiguredAIService();',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/ai/application/service.ts'),
    [
      'import { KieProvider, ReplicateProvider } from "@/extensions/ai/providers";',
      'export function getAIService({ bindings }) {',
      '  if (bindings.kieApiKey) registry.addUnique(new KieProvider({ apiKey: bindings.kieApiKey }));',
      '  if (bindings.replicateApiToken) registry.addUnique(new ReplicateProvider({ apiToken: bindings.replicateApiToken }));',
      '  return { getProvider: (name) => registry.get(name) };',
      '}',
      'export async function getConfiguredAIService() { return getAIService({ bindings: getAiProviderBindings() }); }',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/ai/application/provider-bindings.ts'),
    [
      'export function getAiProviderBindings() {',
      "  return { openrouterApiKey: getRuntimeEnvString('OPENROUTER_API_KEY') || '',",
      "    replicateApiToken: getRuntimeEnvString('REPLICATE_API_TOKEN') || '',",
      "    falApiKey: getRuntimeEnvString('FAL_API_KEY') || '',",
      "    kieApiKey: getRuntimeEnvString('KIE_API_KEY') || '' };",
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(
      rootDir,
      'src/domains/settings/application/settings-runtime.contracts.ts'
    ),
    [
      'export type AiProviderBindings = {',
      '  openrouterApiKey: string;',
      '  replicateApiToken: string;',
      '  falApiKey: string;',
      '  kieApiKey: string;',
      '};',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/infra/runtime/env.server.ts'),
    [
      'export type CloudflareBindings = { AI?: CloudflareAIBinding; KIE_API_KEY?: string; REPLICATE_API_TOKEN?: string; OPENROUTER_API_KEY?: string; FAL_API_KEY?: string; AI_NOTIFY_WEBHOOK_SECRET?: string; };',
      'export function getCloudflareAIBinding() { return getCloudflareBindings()?.AI || null; }',
      'export function getRuntimeEnvString(name) { return process.env[name]; }',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/extensions/ai/index.ts'),
    [
      'export enum AIMediaType { IMAGE = "image", TEXT = "text", MUSIC = "music", VIDEO = "video" }',
      'export interface AIProvider { generate(input: unknown): Promise<unknown>; query?(input: unknown): Promise<unknown>; }',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/extensions/ai/providers.ts'),
    [
      "export { KieProvider } from './kie';",
      "export { ReplicateProvider } from './replicate';",
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/extensions/ai/kie.ts'),
    [
      'export class KieProvider {',
      "  readonly name = 'kie';",
      '  generateMusic() { return safeFetchJson("/generate"); }',
      '  generate({ params }) { if (params.mediaType !== AIMediaType.MUSIC) throw new Error(); return this.generateMusic(); }',
      '  query({ taskId }) { return safeFetchJson(`/generate/record-info?taskId=${taskId}`); }',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/extensions/ai/replicate.ts'),
    [
      'export class ReplicateProvider {',
      "  readonly name = 'replicate';",
      '  generate({ params }) { return this.client.predictions.create({ model: params.model, input: params.options, webhook: params.callbackUrl }); }',
      '  query({ taskId }) { return this.client.predictions.get(taskId); }',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/ai/notify/[provider]/route.ts'),
    [
      'export const POST = withApi(async (req, { params }) => {',
      '  const secret = getAiNotifyWebhookSecret();',
      '  return jsonOk({ ok: true });',
      '});',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/ai/notify/signature.ts'),
    [
      "export function getAiNotifyWebhookSecret() { return getRuntimeEnvString('AI_NOTIFY_WEBHOOK_SECRET') || ''; }",
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/ai/generate/create-handler.ts'),
    [
      'export async function createHandler() {',
      '  const notifySecret = deps.getAiNotifyWebhookSecret();',
      '  if (notifySecret) params.callbackUrl = `/api/ai/notify/${capability.provider}`;',
      '}',
      '',
    ].join('\n')
  );
}

async function writeUsageCreditSourceFiles(rootDir: string) {
  await writeText(
    path.join(rootDir, 'src/domains/remover/domain/plan.ts'),
    [
      "numberEntitlement(entitlements, 'guest_daily_removals', 2);",
      "numberEntitlement(entitlements, 'daily_removals', 5);",
      "numberEntitlement(entitlements, 'monthly_removals', 500);",
      "numberEntitlement(entitlements, 'signup_high_res_downloads', 3);",
      "numberEntitlement(entitlements, 'monthly_high_res_downloads', 300);",
      "numberEntitlement(entitlements, 'retention_days', 7);",
      "numberEntitlement(entitlements, 'max_upload_mb', 20);",
      "booleanEntitlement(entitlements, 'low_res_download', true);",
      "booleanEntitlement(entitlements, 'advanced_mode', false);",
      "booleanEntitlement(entitlements, 'priority_queue', false);",
      "const processingWindow = isPaid ? 'month' : 'day';",
      "const highResDownloadWindow = isPaid ? 'month' : 'lifetime';",
      'export function addRetentionDays() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/remover/domain/quota.ts'),
    [
      'export function getQuotaWindowStart() {}',
      'export function commitQuotaReservation() {}',
      'export function refundQuotaReservation() {}',
      'export function isQuotaReservationReusable() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/remover/domain/types.ts'),
    [
      "export type RemoverQuotaType = 'processing' | 'high_res_download' | 'upload';",
      "export type RemoverQuotaReservationStatus = 'reserved' | 'committed' | 'refunded';",
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/remover/infra/quota-reservation.ts'),
    [
      'export const productQuotaReservation = true;',
      'export function lockRemoverQuotaReservationCreation() { return "remover_idempotency remover_quota"; }',
      'export function createRemoverQuotaReservationWithQuotaCheck() { return { idempotencyKey: true, expiresAt: new Date(), status: "reserved" }; }',
      'export function findRemoverQuotaReservationByIdempotencyKey() {}',
      'export function activeQuotaReservationCondition() { return "reserved refunded expiresAt"; }',
      'export function commitRemoverQuotaReservation() {}',
      'export function refundRemoverQuotaReservation() {}',
      'export function claimRemoverQuotaReservationById() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/remover/application/jobs.ts'),
    [
      'function buildProcessingReservationIdempotencyKey() { return `processing:${ownerKey}:${idempotencyKey}`; }',
      'export async function createQueuedRemoverJob({ deps }) {',
      "  const quotaType = 'processing';",
      '  const windowStart = getQuotaWindowStart(now, plan.processingWindow);',
      '  await deps.createReservation({ quotaType, units: 1, idempotencyKey: buildProcessingReservationIdempotencyKey({}) });',
      '  return deps.createJobWithReservation({ expiresAt: addRetentionDays(now, plan.retentionDays) });',
      '}',
      'export async function claimRemoverJobForActor({ deps }) {',
      '  return deps.claimReservationById({ reservationId, userId });',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/remover/application/processing.ts'),
    [
      'export async function submitRemoverJobToProvider({ deps }) {',
      '  try {',
      '    const output = await deps.storeOutputImage({ job, outputImageUrl });',
      '    await deps.commitReservation({ reservationId: job.quotaReservationId });',
      '    return output;',
      '  } catch (error) {',
      "    await deps.refundReservation({ reason: 'output storage failed' });",
      '  }',
      '  await deps.refundReservation({ reason: "provider failure" });',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/remover/application/download.ts'),
    [
      "type DownloadVariant = 'low_res' | 'high_res';",
      'export async function reserveHighResDownloadQuota({ actor, job }) {',
      '  const idempotencyKey = `high-res-download:${actor.userId}:${job.id}`;',
      "  const quotaType = 'high_res_download';",
      "  const windowStart = plan.highResDownloadWindow === 'lifetime' ? new Date(0) : getQuotaWindowStart(now, plan.highResDownloadWindow);",
      '  return deps.createReservation({ quotaType, units: 1, idempotencyKey, windowStart });',
      '}',
      'export async function resolveRemoverDownload({ variant }) {',
      "  if (variant === 'low_res') return { requiresHighResQuota: false };",
      '  return { requiresHighResQuota: true };',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/remover/jobs/route.ts'),
    [
      'export const deps = { createQueuedRemoverJob, submitRemoverJobToProvider, createRemoverQuotaReservationWithQuotaCheck, commitReservation: commitRemoverQuotaReservation, refundReservation: refundRemoverQuotaReservation };',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/remover/jobs/action.ts'),
    [
      'export async function createRemoverJobsPostAction(deps) {',
      '  return deps.createQueuedRemoverJob();',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/remover/download/action.ts'),
    [
      'export function createRemoverDownloadPostAction(deps) {',
      '  if (download.requiresHighResQuota) reservationId = reserveHighResDownloadQuota();',
      '  return deps.downloadDeps.commitReservation({ reservationId });',
      '}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/remover/download/high-res/route.ts'),
    [
      'export const deps = { reserveHighResQuota: reserveHighResDownloadQuota, commitReservation: commitRemoverQuotaReservation };',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/app/api/remover/download/low-res/route.ts'),
    [
      "const postAction = createRemoverDownloadPostAction(deps, 'low_res');",
      'export const deps = { reserveHighResQuota: reserveHighResDownloadQuota, commitReservation: commitRemoverQuotaReservation };',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/account/infra/credit.ts'),
    [
      'export enum CreditTransactionType { GRANT = "grant", CONSUME = "consume" }',
      'export enum CreditTransactionScene { PAYMENT = "payment", SUBSCRIPTION = "subscription", RENEWAL = "renewal", GIFT = "gift", AWARD = "award" }',
      'export function createExpirationCondition() { return "expiresAt"; }',
      'export async function createCredit() {}',
      'export async function getCredits() {}',
      'export async function getCreditsCount() {}',
      'export async function consumeCredits({ metadata }) { return { consumedDetail: metadata }; }',
      'export async function refundConsumedCreditById() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/domain/credit.ts'),
    [
      'export enum BillingCreditTransactionType { GRANT = "grant" }',
      'export enum BillingCreditTransactionScene { PAYMENT = "payment", SUBSCRIPTION = "subscription", RENEWAL = "renewal" }',
      'export function buildGrantCreditForOrder() {}',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/billing/application/flows.ts'),
    [
      'import { buildGrantCreditForOrder } from "../domain/credit";',
      'export function handleCheckoutSuccess() { const newCredit = buildGrantCreditForOrder(); return newCredit; }',
      'export function handleSubscriptionUpdated() {}',
      'export function handleSubscriptionCanceled() {',
      '  const status = SubscriptionStatus.CANCELED;',
      '  const canceledEndAt = new Date();',
      '  return { status, canceledEndAt };',
      '}',
      'export function handleSubscriptionRenewal() { const newCredit = buildGrantCreditForOrder(); return newCredit; }',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/surfaces/admin/schemas/list/credits.ts'),
    ['export const AdminCreditsListQuerySchema = { credits: true };', ''].join(
      '\n'
    )
  );
  await writeText(
    path.join(rootDir, 'src/app/[locale]/(admin)/admin/credits/page.tsx'),
    [
      'export async function CreditsPage() { return listAdminCreditsQuery(); }',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(
      rootDir,
      'src/domains/account/application/admin-credits.query.ts'
    ),
    ['export async function listAdminCreditsQuery() {}', ''].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/account/application/use-cases.ts'),
    ['export async function listOwnCreditsUseCase() {}', ''].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/config/db/schema.ts'),
    [
      'export const credit = pgTable("credit", { consumedDetail: true, metadata: true, expiresAt: true });',
      'export const productQuotaReservation = pgTable("product_quota_reservation", { idempotencyKey: true, expiresAt: true });',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/config/db/migrations/0006_ai_remover_jobs.sql'),
    'CREATE TABLE "product_quota_reservation";\n'
  );
}

async function createFixtureRoot(pricing: unknown) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'saas-contract-audit-'));
  const siteKey = 'ai-remover';
  await writeJson(path.join(rootDir, 'package.json'), { type: 'module' });
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
      ai: false,
      docs: false,
      blog: false,
    },
    i18n: testSiteI18n,
    configVersion: 1,
  });
  await writeJson(
    path.join(rootDir, 'sites', siteKey, 'deploy.settings.json'),
    {
      configVersion: 1,
      bindingRequirements: {
        bindings: { hyperdrive: true, workersAi: true },
        secrets: {
          authSharedSecret: true,
          googleOauth: true,
          githubOauth: false,
          removerCleanup: true,
          turnstile: false,
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
        admin: 'aooi-ai-remover-admin',
      },
      resources: {
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
    path.join(rootDir, 'src/domains/remover/domain/runtime-contract.ts'),
    [
      'export const AI_REMOVER_RUNTIME_CONTRACT = {',
      "  siteKey: 'ai-remover',",
      "  productKey: 'ai-remover',",
      "  requiredWorkers: { 'public-web': true },",
      '  requiredBindings: { workersAi: true },',
      '  requiredVars: { storagePublicBaseUrl: true },',
      '  requiredSecrets: { removerCleanup: true },',
      '};',
      '',
    ].join('\n')
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
      "  'REMOVER_AI_PROVIDER',",
      "  'REMOVER_AI_MODEL',",
      "  'KIE_API_KEY',",
      "  'REPLICATE_API_TOKEN',",
      "  'OPENROUTER_API_KEY',",
      "  'FAL_API_KEY',",
      "  'AI_NOTIFY_WEBHOOK_SECRET',",
      "  'STORAGE_PUBLIC_BASE_URL',",
      "  'REMOVER_CLEANUP_SECRET',",
      '];',
      '',
    ].join('\n')
  );
  await writeBillingSourceFiles(rootDir);
  await writeProviderSourceFiles(rootDir);
  await writeUsageCreditSourceFiles(rootDir);
  return rootDir;
}

async function createBackgroundRemoverFixtureRoot() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'saas-contract-audit-'));
  const siteKey = 'background-remover';
  await writeJson(path.join(rootDir, 'package.json'), { type: 'module' });
  await writeJson(path.join(rootDir, 'sites', siteKey, 'site.config.json'), {
    key: siteKey,
    domain: 'backgroundremover.example.com',
    brand: {
      appName: 'Background Remover',
      appUrl: 'https://backgroundremover.example.com',
      supportEmail: 'support@backgroundremover.example.com',
      logo: '/logo.png',
      favicon: '/favicon.ico',
      previewImage: '/logo.png',
    },
    capabilities: {
      auth: true,
      payment: 'creem',
      ai: false,
      docs: false,
      blog: false,
    },
    i18n: testSiteI18n,
    configVersion: 1,
  });
  await writeJson(
    path.join(rootDir, 'sites', siteKey, 'deploy.settings.json'),
    {
      configVersion: 1,
      bindingRequirements: {
        bindings: { hyperdrive: true, workersAi: false },
        secrets: {
          authSharedSecret: true,
          googleOauth: true,
          githubOauth: false,
          removerCleanup: true,
          turnstile: false,
        },
        vars: { storagePublicBaseUrl: true },
      },
      workers: {
        router: 'aooi-background-remover-router',
        state: 'aooi-background-remover-state',
        'public-web': 'aooi-background-remover-public-web',
        auth: 'aooi-background-remover-auth',
        payment: 'aooi-background-remover-payment',
        member: 'aooi-background-remover-member',
        admin: 'aooi-background-remover-admin',
      },
      resources: {
        appStorageBucket: 'aooi-background-remover-storage',
        hyperdriveId: '00000000000000000000000000000003',
      },
      state: { schemaVersion: 1 },
    }
  );
  await writeJson(path.join(rootDir, 'sites', siteKey, 'pricing.json'), {
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
            guest_daily_removals: 2,
            daily_removals: 5,
            max_upload_mb: 10,
            retention_days: 7,
          },
        },
        {
          title: 'Pro',
          product_id: 'pro',
          interval: 'month',
          amount: 999,
          currency: 'USD',
          checkout_enabled: true,
          entitlements: {
            monthly_removals: 500,
            max_upload_mb: 20,
            retention_days: 30,
          },
        },
      ],
    },
  });
  await writeText(
    path.join(
      rootDir,
      'src/domains/background-remover/domain/runtime-contract.ts'
    ),
    [
      'export const BACKGROUND_REMOVER_RUNTIME_CONTRACT = {',
      "  siteKey: 'background-remover',",
      "  productKey: 'background-remover',",
      "  requiredWorkers: { 'public-web': true },",
      '  requiredBindings: {},',
      '  requiredVars: { storagePublicBaseUrl: true },',
      '  requiredSecrets: { removerCleanup: true },',
      '};',
      '',
    ].join('\n')
  );
  await writeText(
    path.join(rootDir, 'src/domains/settings/definitions/payment.ts'),
    "export const paymentSettings = [{ name: 'creem_product_ids' }];\n"
  );
  return rootDir;
}

function runAudit(rootDir: string, siteKey = 'ai-remover') {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: rootDir,
    env: {
      ...process.env,
      SITE: siteKey,
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
      i18n: testSiteI18n,
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

test('contract audit keeps refund reversal warnings after placeholder handler exists', async () => {
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
      '  [PaymentEventType.PAYMENT_FAILED]: handlePaymentFailedEvent,',
      '  [PaymentEventType.PAYMENT_REFUNDED]: handlePaymentRefundedEvent,',
      '  [PaymentEventType.SUBSCRIBE_UPDATED]: handleSubscriptionUpdatedEvent,',
      '  [PaymentEventType.SUBSCRIBE_CANCELED]: handleSubscriptionCanceledEvent,',
      '};',
      'function handleUnknownEvent() { recordUnknownWebhookEvent(); }',
      'function handleCheckoutSuccessEvent() {}',
      'function handlePaymentSuccessEvent(event) {',
      '  if (event.subscriptionCycleType === SubscriptionCycleType.RENEWAL) return;',
      '}',
      'function handlePaymentFailedEvent() {}',
      'function handlePaymentRefundedEvent() {}',
      'function handleSubscriptionUpdatedEvent() {}',
      'function handleSubscriptionCanceledEvent() {}',
      '',
    ].join('\n')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /payment\.failed: handled/);
  assert.match(result.stdout, /payment\.refunded: partially_handled/);
  assert.doesNotMatch(result.stdout, /payment\.failed is canonical/);
  assert.doesNotMatch(result.stdout, /payment\.refunded is canonical/);
  assert.match(
    result.stdout,
    /warning  payment\.refunded has a notify handler but no source-mapped reversal coverage/
  );
  assert.match(
    result.stdout,
    /source  billing_domain:src\/domains\/billing\/domain\/payment\.ts:PaymentEventType\.PAYMENT_REFUNDED/
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

test('contract audit covers AI Remover product runtime requirements without enabling chat AI capability', async () => {
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
  assert.match(result.stdout, /Product runtime contracts:/);
  assert.match(result.stdout, /ai-remover: resolved/);
  assert.match(result.stdout, /worker=public-web declared/);
  assert.match(result.stdout, /binding=workersAi declared/);
  assert.match(result.stdout, /var=storagePublicBaseUrl declared/);
  assert.match(result.stdout, /secret=removerCleanup declared/);
  assert.doesNotMatch(result.stdout, /chat \(site\.capabilities\.ai\)/);
  assert.match(result.stdout, /binding=workersAi runtime_owned/);
  assert.match(result.stdout, /openrouter: partial/);
});

test('contract audit covers Background Remover without shared AI runtime', async () => {
  const rootDir = await createBackgroundRemoverFixtureRoot();

  const result = runAudit(rootDir, 'background-remover');

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /SaaS product contract audit: background-remover/
  );
  assert.match(result.stdout, /background-remover: resolved/);
  assert.match(result.stdout, /worker=public-web declared/);
  assert.match(result.stdout, /var=storagePublicBaseUrl declared/);
  assert.match(result.stdout, /secret=removerCleanup declared/);
  assert.doesNotMatch(result.stdout, /binding=workersAi declared/);
  assert.match(result.stdout, /SITE=background-remover pnpm cf:check/);
});

test('contract audit fails when AI Remover product runtime binding is disabled', async () => {
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
  const deploySettingsPath = path.join(
    rootDir,
    'sites/ai-remover/deploy.settings.json'
  );
  await updateJson(deploySettingsPath, (current) => ({
    ...current,
    bindingRequirements: {
      ...(current.bindingRequirements as Record<string, unknown>),
      bindings: {
        ...((current.bindingRequirements as { bindings: object }).bindings ??
          {}),
        hyperdrive: true,
        workersAi: false,
      },
    },
  }));

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /blocker  Product runtime contract ai-remover missing binding workersAi/
  );
  assert.match(
    result.stdout,
    /source  product_runtime_contract:src\/domains\/remover\/domain\/runtime-contract\.ts:workersAi/
  );
  assert.match(
    result.stdout,
    /source  deploy_settings:sites\/ai-remover\/deploy\.settings\.json:bindings\.workersAi/
  );
});

test('contract audit fails when AI Remover product runtime secret is disabled', async () => {
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
  const deploySettingsPath = path.join(
    rootDir,
    'sites/ai-remover/deploy.settings.json'
  );
  await updateJson(deploySettingsPath, (current) => ({
    ...current,
    bindingRequirements: {
      ...(current.bindingRequirements as Record<string, unknown>),
      secrets: {
        ...((current.bindingRequirements as { secrets: object }).secrets ?? {}),
        removerCleanup: false,
      },
    },
  }));

  const result = runAudit(rootDir);

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /blocker  Product runtime contract ai-remover missing secret removerCleanup/
  );
  assert.match(
    result.stdout,
    /source  deploy_settings:sites\/ai-remover\/deploy\.settings\.json:secrets\.removerCleanup/
  );
});

test('contract audit prints provider readiness report', async () => {
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
  assert.match(result.stdout, /Provider readiness:/);
  assert.match(
    result.stdout,
    /selected provider: cloudflare-workers-ai \(defaulted\)/
  );
  assert.match(
    result.stdout,
    /selected model: @cf\/runwayml\/stable-diffusion-v1-5-inpainting \(defaulted\)/
  );
  assert.match(result.stdout, /cloudflare-workers-ai: ready/);
  assert.match(result.stdout, /taskMode=sync input=image\+mask output=image/);
  assert.match(result.stdout, /binding=workersAi runtime_owned/);
  assert.match(result.stdout, /kie: partial/);
  assert.match(result.stdout, /secret=KIE_API_KEY runtime_owned/);
  assert.match(result.stdout, /replicate: partial/);
  assert.match(result.stdout, /secret=REPLICATE_API_TOKEN runtime_owned/);
  assert.match(result.stdout, /openrouter: partial/);
  assert.match(result.stdout, /secret=OPENROUTER_API_KEY binding_defined/);
  assert.match(result.stdout, /fal: partial/);
  assert.match(result.stdout, /secret=FAL_API_KEY binding_defined/);
});

test('contract audit source-maps provider defaults and Workers AI binding', async () => {
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
    /source  provider_route:src\/app\/api\/remover\/provider-adapter\.server\.ts:REMOVER_AI_PROVIDER/
  );
  assert.match(
    result.stdout,
    /source  provider_domain:src\/domains\/remover\/application\/provider\.ts:DEFAULT_CLOUDFLARE_INPAINTING_MODEL/
  );
  assert.match(
    result.stdout,
    /source  deploy_settings:sites\/ai-remover\/deploy\.settings\.json:bindings\.workersAi/
  );
  assert.match(
    result.stdout,
    /source  provider_runtime:src\/infra\/runtime\/env\.server\.ts:getCloudflareAIBinding/
  );
});

test('contract audit reports binding-defined providers without registration', async () => {
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
    /warning  Provider openrouter has binding definitions but no registered provider implementation/
  );
  assert.match(
    result.stdout,
    /source  provider_application:src\/domains\/ai\/application\/provider-bindings\.ts:OPENROUTER_API_KEY/
  );
  assert.match(
    result.stdout,
    /warning  Provider fal has binding definitions but no registered provider implementation/
  );
  assert.match(
    result.stdout,
    /source  provider_application:src\/domains\/ai\/application\/provider-bindings\.ts:FAL_API_KEY/
  );
});

test('contract audit degrades missing provider source files into source-mapped warnings', async () => {
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
    path.join(rootDir, 'src/app/api/remover/provider-adapter.server.ts')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /warning  Provider readiness audit source is missing: AI Remover provider adapter/
  );
  assert.match(
    result.stdout,
    /source  provider_route:src\/app\/api\/remover\/provider-adapter\.server\.ts/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});

test('contract audit prints usage and credits mapping report', async () => {
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
            guest_daily_removals: 2,
            daily_removals: 5,
            signup_high_res_downloads: 3,
            retention_days: 7,
            low_res_download: true,
          },
        },
        {
          title: 'Pro',
          product_id: 'pro-monthly',
          interval: 'month',
          amount: 999,
          currency: 'USD',
          checkout_enabled: true,
          entitlements: {
            monthly_removals: 500,
            monthly_high_res_downloads: 300,
            advanced_mode: true,
            max_upload_mb: 20,
            retention_days: 30,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage \/ credits:/);
  assert.match(result.stdout, /product quota:/);
  assert.match(result.stdout, /processing: product_owned/);
  assert.match(result.stdout, /subject=anonymous\+user/);
  assert.match(result.stdout, /reserve=explicit_reservation/);
  assert.match(result.stdout, /storage=product_quota_reservation/);
  assert.match(result.stdout, /high_res_download: product_owned/);
  assert.match(result.stdout, /window=lifetime\/month/);
  assert.match(result.stdout, /platform credit ledger: platform_owned/);
  assert.match(result.stdout, /generic usage table=present/);
});

test('contract audit source-maps AI Remover processing quota', async () => {
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
    /source  usage_product_application:src\/domains\/remover\/application\/jobs\.ts:createQueuedRemoverJob/
  );
  assert.match(
    result.stdout,
    /source  usage_product_infra:src\/domains\/remover\/infra\/quota-reservation\.ts:createRemoverQuotaReservationWithQuotaCheck/
  );
  assert.match(
    result.stdout,
    /source  usage_product_domain:src\/domains\/remover\/domain\/quota\.ts:getQuotaWindowStart/
  );
  assert.match(
    result.stdout,
    /source  usage_product_application:src\/domains\/remover\/application\/processing\.ts:commitReservation/
  );
});

test('contract audit source-maps high-res download quota separately from low-res', async () => {
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
  assert.match(result.stdout, /high_res_download: product_owned/);
  assert.match(result.stdout, /subject=user/);
  assert.match(result.stdout, /unit=download/);
  assert.match(result.stdout, /refund=missing/);
  assert.match(
    result.stdout,
    /source  usage_product_application:src\/domains\/remover\/application\/download\.ts:reserveHighResDownloadQuota/
  );
  assert.match(
    result.stdout,
    /source  usage_product_route:src\/app\/api\/remover\/download\/low-res\/route\.ts:low_res/
  );
});

test('contract audit maps pricing entitlements to usage access and product semantics', async () => {
  const rootDir = await createFixtureRoot({
    pricing: {
      items: [
        {
          title: 'Studio',
          product_id: 'studio-monthly',
          interval: 'month',
          amount: 1999,
          currency: 'USD',
          checkout_enabled: true,
          entitlements: {
            guest_daily_removals: 2,
            daily_removals: 5,
            monthly_removals: 2000,
            signup_high_res_downloads: 3,
            monthly_high_res_downloads: 1500,
            retention_days: 30,
            max_upload_mb: 20,
            low_res_download: true,
            advanced_mode: true,
            priority_queue: true,
          },
        },
      ],
    },
  });

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /guest_daily_removals -> anonymous processing daily limit \(usage_limit\)/
  );
  assert.match(
    result.stdout,
    /monthly_high_res_downloads -> paid high-res monthly allowance \(usage_limit\)/
  );
  assert.match(
    result.stdout,
    /low_res_download -> low-res download access \(access\)/
  );
  assert.match(
    result.stdout,
    /advanced_mode -> AI Remover advanced mode flag \(product_flag\)/
  );
  assert.match(
    result.stdout,
    /priority_queue -> AI Remover priority queue flag \(product_flag\)/
  );
});

test('contract audit keeps platform credit ledger separate from product quota', async () => {
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
  assert.match(result.stdout, /grant=present/);
  assert.match(result.stdout, /consume=present/);
  assert.match(result.stdout, /refund consumed=present/);
  assert.match(result.stdout, /expiration=present/);
  assert.match(result.stdout, /admin visibility=present/);
  assert.match(result.stdout, /manual compensation=partial/);
  assert.match(
    result.stdout,
    /warning  AI Remover processing and high-res limits use productQuotaReservation, not the platform credit ledger/
  );
  assert.match(
    result.stdout,
    /source  usage_platform_credit:src\/domains\/account\/infra\/credit\.ts:credit/
  );
});

test('contract audit degrades missing usage credit source files into source-mapped warnings', async () => {
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
    path.join(rootDir, 'src/domains/remover/infra/quota-reservation.ts')
  );

  const result = runAudit(rootDir);

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /warning  Usage \/ credits audit source is missing: AI Remover quota reservation infra/
  );
  assert.match(
    result.stdout,
    /source  usage_product_infra:src\/domains\/remover\/infra\/quota-reservation\.ts/
  );
  assert.doesNotMatch(result.stderr, /SaaS contract audit failed/);
});
