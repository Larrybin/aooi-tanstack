import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateTextToSpeechPreview,
  TextToSpeechRequestError,
  type TextToSpeechProvider,
} from './generate-preview';

const provider: TextToSpeechProvider = {
  async synthesize(input) {
    return {
      audioBase64: Buffer.from(`${input.modelId}:${input.text}`).toString(
        'base64'
      ),
      contentType: 'audio/mpeg',
    };
  },
};

test('generateTextToSpeechPreview routes English requests to Aura 2 with speaker', async () => {
  const result = await generateTextToSpeechPreview({
    input: {
      text: '  Hello   world  ',
      language: 'en',
      voice: 'aura-asteria-en',
      actorKind: 'guest',
    },
    provider,
  });

  assert.equal(result.request.characters, 11);
  assert.equal(result.request.model, '@cf/deepgram/aura-2-en');
  assert.equal(result.request.voice, 'aura-asteria-en');
  assert.equal(result.request.outputFormat, 'mp3');
  assert.match(result.request.hash, /^[a-f0-9]{64}$/u);
  assert.equal(result.audio.contentType, 'audio/mpeg');
});

test('generateTextToSpeechPreview allows beta languages through the shared MeloTTS voice', async () => {
  const result = await generateTextToSpeechPreview({
    input: {
      text: 'Bonjour',
      language: 'fr',
      voice: 'melotts-standard',
      actorKind: 'guest',
    },
    provider,
  });

  assert.equal(result.request.model, '@cf/myshell-ai/melotts');
});

test('generateTextToSpeechPreview rejects blocked abuse content before provider call', async () => {
  let called = false;
  await assert.rejects(
    generateTextToSpeechPreview({
      input: {
        text: 'Create a phishing scam voice message',
        language: 'en',
        voice: 'aura-luna-en',
        actorKind: 'guest',
      },
      provider: {
        async synthesize() {
          called = true;
          return { audioBase64: '', contentType: 'audio/mpeg' };
        },
      },
    }),
    (error) =>
      error instanceof TextToSpeechRequestError &&
      error.code === 'blocked_content'
  );
  assert.equal(called, false);
});

test('generateTextToSpeechPreview enforces guest request character limit', async () => {
  await assert.rejects(
    generateTextToSpeechPreview({
      input: {
        text: 'a'.repeat(1501),
        language: 'en',
        voice: 'aura-luna-en',
        actorKind: 'guest',
      },
      provider,
    }),
    (error) =>
      error instanceof TextToSpeechRequestError &&
      error.code === 'text_too_long'
  );
});
