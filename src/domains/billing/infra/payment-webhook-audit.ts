
import { db } from '@/infra/adapters/db';

import { paymentWebhookAudit } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export type PaymentWebhookAuditRecord = typeof paymentWebhookAudit.$inferSelect;

export type RecordPaymentWebhookAuditInput = {
  provider: string;
  eventType: string;
  eventId?: string | null;
  rawDigest: string;
  receivedAt: Date;
};

function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

export async function recordPaymentWebhookAudit(
  input: RecordPaymentWebhookAuditInput
): Promise<void> {
  await db()
    .insert(paymentWebhookAudit)
    .values({
      id: getUuid(),
      provider: input.provider,
      eventType: input.eventType,
      eventId: normalizeOptionalText(input.eventId),
      rawDigest: input.rawDigest,
      receivedAt: input.receivedAt,
    })
    .onConflictDoNothing({
      target: [paymentWebhookAudit.provider, paymentWebhookAudit.rawDigest],
    });
}
