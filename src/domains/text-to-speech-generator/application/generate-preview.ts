import {
  resolveTextToSpeechPreviewRequest,
  TextToSpeechRequestError,
  type TextToSpeechActorKind,
} from '../domain/request';

export type TextToSpeechSynthesisInput = {
  text: string;
  language: string;
  voiceId: string;
  speaker?: string;
  modelId: string;
  outputFormat: 'mp3';
};

export type TextToSpeechSynthesisResult = {
  audioBase64: string;
  contentType: 'audio/mpeg';
};

export type TextToSpeechProvider = {
  synthesize(
    input: TextToSpeechSynthesisInput
  ): Promise<TextToSpeechSynthesisResult>;
};

export type GenerateTextToSpeechPreviewInput = {
  text: string;
  language: string;
  voice: string;
  actorKind: TextToSpeechActorKind;
};

export type GenerateTextToSpeechPreviewResult = {
  audio: TextToSpeechSynthesisResult;
  request: {
    characters: number;
    language: string;
    voice: string;
    model: string;
    outputFormat: 'mp3';
    hash: string;
  };
  generation?: {
    id: string;
    textPreview: string;
    expiresAt: Date;
    reused: boolean;
  };
  warnings: string[];
};

export { TextToSpeechRequestError };

export async function generateTextToSpeechPreview({
  input,
  provider,
}: {
  input: GenerateTextToSpeechPreviewInput;
  provider: TextToSpeechProvider;
}): Promise<GenerateTextToSpeechPreviewResult> {
  const request = resolveTextToSpeechPreviewRequest(input);
  const audio = await provider.synthesize({
    text: request.text,
    language: request.language,
    voiceId: request.voice.id,
    speaker: request.voice.speaker,
    modelId: request.modelId,
    outputFormat: request.outputFormat,
  });

  return {
    audio,
    request: {
      characters: request.characters,
      language: request.language,
      voice: request.voice.id,
      model: request.modelId,
      outputFormat: request.outputFormat,
      hash: request.requestHash,
    },
    warnings: [
      'Playback speed only changes the browser player speed; the generated MP3 is not speed-adjusted.',
    ],
  };
}
