import type { TextToSpeechActor } from './types';

export type TextToSpeechPlanLimits = {
  productId: string;
  singleRequestCharacters: number;
  monthlyCharacters: number;
  guestDailyPreviews: number;
  historyItems: number;
  retentionDays: number;
};

function readNumberEntitlement(
  actor: TextToSpeechActor,
  key: string,
  fallback: number
): number {
  if (actor.kind !== 'user') {
    return fallback;
  }

  const value = actor.entitlements?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

export function resolveTextToSpeechPlanLimits(
  actor: TextToSpeechActor
): TextToSpeechPlanLimits {
  if (actor.kind !== 'user') {
    return {
      productId: 'guest',
      singleRequestCharacters: 1500,
      monthlyCharacters: 0,
      guestDailyPreviews: 5,
      historyItems: 3,
      retentionDays: 3,
    };
  }

  return {
    productId: actor.productId ?? 'free',
    singleRequestCharacters: readNumberEntitlement(
      actor,
      'single_request_characters',
      3500
    ),
    monthlyCharacters: readNumberEntitlement(
      actor,
      'monthly_characters',
      10000
    ),
    guestDailyPreviews: 5,
    historyItems: readNumberEntitlement(actor, 'history_items', 3),
    retentionDays: readNumberEntitlement(actor, 'retention_days', 3),
  };
}

export function addTextToSpeechRetentionDays(now: Date, days: number): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + Math.max(1, days));
  return expiresAt;
}
