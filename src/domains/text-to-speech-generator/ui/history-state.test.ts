import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeTextToSpeechHistory,
  type TextToSpeechHistoryItem,
} from './history-state';

function historyItem(id: string): TextToSpeechHistoryItem {
  return {
    id,
    status: 'generated',
    textPreview: id,
    characterCount: 10,
    language: 'en',
    voice: 'aura-luna-en',
    model: '@cf/deepgram/aura-2-luna-en',
    outputFormat: 'mp3',
    createdAt: '2026-06-05T00:00:00.000Z',
    expiresAt: '2026-07-05T00:00:00.000Z',
    audioAvailable: true,
    downloadAvailable: true,
  };
}

test('mergeTextToSpeechHistory prepends generated items without dropping existing history', () => {
  assert.deepEqual(
    mergeTextToSpeechHistory({
      current: [historyItem('old-1'), historyItem('old-2')],
      incoming: [historyItem('new-1')],
    }).map((item) => item.id),
    ['new-1', 'old-1', 'old-2']
  );
});

test('mergeTextToSpeechHistory keeps returned items authoritative when ids repeat', () => {
  assert.deepEqual(
    mergeTextToSpeechHistory({
      current: [historyItem('same'), historyItem('old-1')],
      incoming: [historyItem('same')],
    }).map((item) => item.id),
    ['same', 'old-1']
  );
});
