import type { TextToSpeechActor } from './types';

export type TextToSpeechPlanLimits = {
  productId: string;
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
  return {
    productId: actor.kind === 'user' ? (actor.productId ?? 'free') : 'guest',
    historyItems: readNumberEntitlement(actor, 'history_items', 3),
    retentionDays: readNumberEntitlement(actor, 'retention_days', 3),
  };
}

export function addTextToSpeechRetentionDays(now: Date, days: number): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + Math.max(1, days));
  return expiresAt;
}
