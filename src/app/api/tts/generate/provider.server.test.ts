import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAudioBase64 } from './provider.server';

function streamFromBytes(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

test('normalizeAudioBase64 reads Workers AI Deepgram audio streams', async () => {
  const audio = Buffer.from('deepgram-audio');

  assert.equal(
    await normalizeAudioBase64(streamFromBytes(audio)),
    audio.toString('base64')
  );
});
