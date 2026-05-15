import { z } from 'zod';

export const RemoverUploadKindSchema = z.enum(['original', 'mask']);

export const RemoverJobCreateBodySchema = z
  .object({
    inputImageAssetId: z.string().trim().min(1),
    maskImageAssetId: z.string().trim().min(1),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export const RemoverJobParamsSchema = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

export const RemoverDownloadBodySchema = z
  .object({
    jobId: z.string().trim().min(1),
  })
  .strict();

export type RemoverJobCreateBody = z.infer<typeof RemoverJobCreateBodySchema>;
export type RemoverDownloadBody = z.infer<typeof RemoverDownloadBodySchema>;
