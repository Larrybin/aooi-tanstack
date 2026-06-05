import {
  getTextToSpeechHistoryLimit,
  serializeTextToSpeechGenerationForClient,
  type TextToSpeechGenerationRecord,
} from '../domain/history';
import type { TextToSpeechActor } from '../domain/types';

export async function listTextToSpeechHistory({
  actor,
  deps,
}: {
  actor: TextToSpeechActor;
  deps: {
    listGenerations: (input: {
      userId: string | null;
      anonymousSessionId: string | null;
      limit: number;
    }) => Promise<TextToSpeechGenerationRecord[]>;
    now?: () => Date;
  };
}) {
  const now = (deps.now ?? (() => new Date()))();
  const generations = await deps.listGenerations({
    userId: actor.kind === 'user' ? actor.userId : null,
    anonymousSessionId: actor.anonymousSessionId ?? null,
    limit: getTextToSpeechHistoryLimit(actor),
  });

  return generations.map((generation) =>
    serializeTextToSpeechGenerationForClient({ actor, generation, now })
  );
}
