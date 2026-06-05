import 'server-only';

import type {
  TextToSpeechProvider,
  TextToSpeechSynthesisInput,
  TextToSpeechSynthesisResult,
} from '@/domains/text-to-speech-generator/application/generate-preview';
import { getCloudflareAIBinding } from '@/infra/runtime/env.server';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';

type CloudflareTtsOutput =
  | string
  | Uint8Array
  | ArrayBuffer
  | { audio?: string | number[] };

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

function normalizeAudioBase64(output: CloudflareTtsOutput): string {
  if (typeof output === 'string') {
    return output;
  }

  if (output instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(output));
  }

  if (output instanceof Uint8Array) {
    return bytesToBase64(output);
  }

  if (typeof output.audio === 'string') {
    return output.audio;
  }

  if (Array.isArray(output.audio)) {
    return bytesToBase64(Uint8Array.from(output.audio));
  }

  throw new Error('Cloudflare TTS returned unsupported audio payload');
}

function buildCloudflareTtsInputs(input: TextToSpeechSynthesisInput) {
  if (input.modelId === '@cf/myshell-ai/melotts') {
    return {
      prompt: input.text,
      lang: input.language,
    };
  }

  return {
    text: input.text,
    speaker: input.speaker,
    encoding: input.outputFormat,
  };
}

export function createCloudflareTextToSpeechProvider(): TextToSpeechProvider {
  return {
    async synthesize(
      input: TextToSpeechSynthesisInput
    ): Promise<TextToSpeechSynthesisResult> {
      const ai = getCloudflareAIBinding();
      if (!ai) {
        throw new ServiceUnavailableError('Cloudflare AI binding is missing');
      }

      const output = (await ai.run(
        input.modelId,
        buildCloudflareTtsInputs(input)
      )) as CloudflareTtsOutput;

      return {
        audioBase64: normalizeAudioBase64(output),
        contentType: 'audio/mpeg',
      };
    },
  };
}
