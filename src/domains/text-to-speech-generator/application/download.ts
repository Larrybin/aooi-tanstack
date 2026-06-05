import {
  assertTextToSpeechGenerationDownloadable,
  type TextToSpeechGenerationRecord,
} from '../domain/history';
import type { TextToSpeechActor } from '../domain/types';

export async function resolveTextToSpeechDownload({
  actor,
  generationId,
  deps,
}: {
  actor: TextToSpeechActor;
  generationId: string;
  deps: {
    findGenerationById: (
      id: string
    ) => Promise<TextToSpeechGenerationRecord | undefined>;
    now?: () => Date;
  };
}) {
  const generation = assertTextToSpeechGenerationDownloadable({
    actor,
    generation: await deps.findGenerationById(generationId),
    now: (deps.now ?? (() => new Date()))(),
  });

  return {
    generation,
    storageKey: generation.storageKey,
    filename: `text-to-speech-${generation.id}.mp3`,
  };
}
