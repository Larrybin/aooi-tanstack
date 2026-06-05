import { resolveTextToSpeechPlanLimits } from '../domain/plan';
import { getTextToSpeechQuotaWindowStart } from '../domain/quota';
import type { TextToSpeechActor } from '../domain/types';

function getNextMonthlyResetAt(windowStart: Date): Date {
  return new Date(
    Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + 1, 1)
  );
}

export async function resolveTextToSpeechQuotaSummary({
  actor,
  deps,
}: {
  actor: TextToSpeechActor;
  deps: {
    countMonthlyQuotaUnits: (input: {
      userId: string;
      windowStart: Date;
      now: Date;
    }) => Promise<number>;
    getRemainingCredits: (userId: string) => Promise<number>;
    now?: () => Date;
  };
}) {
  const now = (deps.now ?? (() => new Date()))();
  const plan = resolveTextToSpeechPlanLimits(actor);
  const windowStart = getTextToSpeechQuotaWindowStart(now);

  if (actor.kind !== 'user') {
    return {
      actorKind: actor.kind,
      productId: plan.productId,
      monthlyCharacters: 0,
      monthlyUsedCharacters: 0,
      monthlyRemainingCharacters: 0,
      extraCreditsRemaining: 0,
      resetAt: null,
      guestDailyPreviews: plan.guestDailyPreviews,
    };
  }

  const [monthlyUsedCharacters, extraCreditsRemaining] = await Promise.all([
    deps.countMonthlyQuotaUnits({
      userId: actor.userId,
      windowStart,
      now,
    }),
    deps.getRemainingCredits(actor.userId),
  ]);

  return {
    actorKind: actor.kind,
    productId: plan.productId,
    monthlyCharacters: plan.monthlyCharacters,
    monthlyUsedCharacters,
    monthlyRemainingCharacters: Math.max(
      0,
      plan.monthlyCharacters - monthlyUsedCharacters
    ),
    extraCreditsRemaining,
    resetAt: getNextMonthlyResetAt(windowStart),
    guestDailyPreviews: plan.guestDailyPreviews,
  };
}
