export type TextToSpeechHistoryItem = {
  id: string;
  status: string;
  textPreview: string;
  characterCount: number;
  language: string;
  voice: string;
  model: string;
  outputFormat: string;
  createdAt: string;
  expiresAt: string;
  audioAvailable: boolean;
  downloadAvailable: boolean;
};

export function mergeTextToSpeechHistory({
  current,
  incoming,
}: {
  current: TextToSpeechHistoryItem[];
  incoming: TextToSpeechHistoryItem[];
}) {
  if (!incoming.length) {
    return current;
  }

  const seen = new Set<string>();
  return [...incoming, ...current].filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}
