import { z } from 'zod';

export const TextToSpeechGenerateBodySchema = z
  .object({
    text: z.string(),
    language: z.string().trim().min(1),
    voice: z.string().trim().min(1),
  })
  .strict();

export type TextToSpeechGenerateBody = z.infer<
  typeof TextToSpeechGenerateBodySchema
>;
