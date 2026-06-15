
import { createHash } from 'crypto';
import {
  PaymentEventType,
  type PaymentEvent,
} from '@/domains/billing/domain/payment';
import { serializePaymentWebhookCanonicalEvent } from '@/domains/billing/infra/payment-webhook-canonical-event';
import {
  PAYMENT_WEBHOOK_INBOX_STATUS,
  PAYMENT_WEBHOOK_OPERATION_KIND,
  type PaymentWebhookInboxStatus,
  type PaymentWebhookOperationKind,
} from '@/domains/billing/infra/payment-webhook-inbox.shared';
import { db } from '@/infra/adapters/db';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import { paymentWebhookInbox } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export { PAYMENT_WEBHOOK_INBOX_STATUS, PAYMENT_WEBHOOK_OPERATION_KIND };
export type { PaymentWebhookInboxStatus, PaymentWebhookOperationKind };

export type PaymentWebhookInboxRecord = typeof paymentWebhookInbox.$inferSelect;

function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function extractEventId(event: PaymentEvent): string | null {
  const paymentSession = event.paymentSession;
  const metadata = paymentSession.metadata || {};
  const eventResult =
    event.eventResult && typeof event.eventResult === 'object'
      ? (event.eventResult as Record<string, unknown>)
      : {};

  return (
    normalizeOptionalText(metadata.event_id as string | undefined) ||
    normalizeOptionalText(metadata.eventId as string | undefined) ||
    normalizeOptionalText(metadata.id as string | undefined) ||
    normalizeOptionalText(eventResult.event_id as string | undefined) ||
    normalizeOptionalText(eventResult.eventId as string | undefined) ||
    normalizeOptionalText(eventResult.id as string | undefined)
  );
}

function extractEventType(event: PaymentEvent): string | null {
  const paymentSession = event.paymentSession;
  const metadata = paymentSession.metadata || {};

  return (
    normalizeOptionalText(metadata.event_type as string | undefined) ||
    normalizeOptionalText(metadata.eventType as string | undefined) ||
    normalizeOptionalText(event.eventType)
  );
}

export function buildPaymentWebhookRawDigest(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function serializePaymentWebhookHeaders(headers: Headers): string {
  return JSON.stringify(Object.fromEntries(headers.entries()));
}

export async function createPaymentWebhookInboxReceipt(input: {
  provider: string;
  rawBody: string;
  rawHeaders: string;
  source: string;
  receivedAt: Date;
}) {
  const rawDigest = buildPaymentWebhookRawDigest(input.rawBody);
  const [inserted] = await db()
    .insert(paymentWebhookInbox)
    .values({
      id: getUuid(),
      provider: input.provider,
      rawBody: input.rawBody,
      rawHeaders: input.rawHeaders,
      rawDigest,
      status: PAYMENT_WEBHOOK_INBOX_STATUS.RECEIVED,
      source: input.source,
      receivedAt: input.receivedAt,
    })
    .onConflictDoNothing({
      target: [paymentWebhookInbox.provider, paymentWebhookInbox.rawDigest],
    })
    .returning();

  if (inserted) {
    return { record: inserted, isNew: true };
  }

  const [existing] = await db()
    .select()
    .from(paymentWebhookInbox)
    .where(
      and(
        eq(paymentWebhookInbox.provider, input.provider),
        eq(paymentWebhookInbox.rawDigest, rawDigest)
      )
    );

  if (!existing) {
    throw new Error('payment webhook inbox receipt upsert failed');
  }

  return { record: existing, isNew: false };
}

export async function recordPaymentWebhookInboxCanonicalEvent(input: {
  inboxId: string;
  event: PaymentEvent;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      eventId: extractEventId(input.event),
      eventType: extractEventType(input.event),
      canonicalEvent: serializePaymentWebhookCanonicalEvent(input.event),
      lastError: null,
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxAttempt(input: {
  inboxId: string;
  operatorUserId?: string | null;
  operatorNote?: string | null;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      operatorUserId: normalizeOptionalText(input.operatorUserId),
      operatorNote: normalizeOptionalText(input.operatorNote),
      processingAttemptCount: sql`${paymentWebhookInbox.processingAttemptCount} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxParseFailed(input: {
  inboxId: string;
  error: unknown;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      status: PAYMENT_WEBHOOK_INBOX_STATUS.PARSE_FAILED,
      lastError: String(input.error),
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxProcessFailed(input: {
  inboxId: string;
  error: unknown;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      status: PAYMENT_WEBHOOK_INBOX_STATUS.PROCESS_FAILED,
      lastError: String(input.error),
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxProcessed(input: {
  inboxId: string;
  eventType: PaymentEventType;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      status:
        input.eventType === PaymentEventType.UNKNOWN
          ? PAYMENT_WEBHOOK_INBOX_STATUS.IGNORED_UNKNOWN
          : PAYMENT_WEBHOOK_INBOX_STATUS.PROCESSED,
      lastProcessedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function findPaymentWebhookInboxByIds(ids: string[]) {
  const normalizedIds = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (normalizedIds.length === 0) {
    return [] as PaymentWebhookInboxRecord[];
  }

  return db()
    .select()
    .from(paymentWebhookInbox)
    .where(inArray(paymentWebhookInbox.id, normalizedIds))
    .orderBy(desc(paymentWebhookInbox.receivedAt));
}

export async function getPaymentWebhookInboxPreview(input: {
  provider?: string;
  eventId?: string;
  status?: PaymentWebhookInboxStatus | 'all';
  receivedFrom?: Date | null;
  receivedTo?: Date | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));

  return db()
    .select()
    .from(paymentWebhookInbox)
    .where(
      and(
        input.provider
          ? eq(paymentWebhookInbox.provider, input.provider.trim())
          : undefined,
        input.eventId
          ? eq(paymentWebhookInbox.eventId, input.eventId.trim())
          : undefined,
        input.status && input.status !== 'all'
          ? eq(paymentWebhookInbox.status, input.status)
          : undefined,
        input.receivedFrom
          ? gte(paymentWebhookInbox.receivedAt, input.receivedFrom)
          : undefined,
        input.receivedTo
          ? lte(paymentWebhookInbox.receivedAt, input.receivedTo)
          : undefined
      )
    )
    .orderBy(desc(paymentWebhookInbox.receivedAt))
    .limit(limit);
}
