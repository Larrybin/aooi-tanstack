import type { ApiContext } from '@/app/api/_lib/context';
import { uploadRemoverImage } from '@/domains/remover/application/upload';
import type { RemoverActor } from '@/domains/remover/domain/types';
import type { getStorageService } from '@/infra/adapters/storage/service';
import { z } from 'zod';

import { BadRequestError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { RemoverUploadKindSchema } from '@/shared/schemas/api/remover';

type UploadActionDeps = {
  createApiContext: (req: Request) => ApiContext;
  resolveActor: (req: Request) => Promise<RemoverActor>;
  readUploadRequestInput: (
    req: Request,
    fieldName: string
  ) => Promise<{
    formData: FormData;
    entries: unknown[];
    files: File[];
  }>;
  getStorageService: typeof getStorageService;
  detectImageMime: (buffer: Buffer) => string | null;
  createAsset: Parameters<typeof uploadRemoverImage>[0]['deps']['createAsset'];
  reserveUploadQuota: Parameters<
    typeof uploadRemoverImage
  >[0]['deps']['reserveUploadQuota'];
  commitReservation: Parameters<
    typeof uploadRemoverImage
  >[0]['deps']['commitReservation'];
  refundReservation: Parameters<
    typeof uploadRemoverImage
  >[0]['deps']['refundReservation'];
  acquireGuestIpLimit?: (input: {
    actor: RemoverActor;
    req: Request;
  }) => Promise<(() => Promise<void>) | undefined>;
};

const DimensionSchema = z.coerce.number().int().positive().max(100000).optional();

function parseDimension(formData: FormData, key: string): number | undefined {
  const raw = formData.get(key);
  if (raw === null || raw === '') {
    return;
  }
  const result = DimensionSchema.safeParse(raw);
  if (!result.success) {
    throw new BadRequestError(`invalid ${key}`);
  }
  return result.data;
}

export function createRemoverUploadPostAction(deps: UploadActionDeps) {
  return async (req: Request) => {
    const api = deps.createApiContext(req);
    const actor = await deps.resolveActor(req);
    const { formData, entries, files } = await deps.readUploadRequestInput(
      req,
      'image'
    );

    if (entries.length !== files.length || files.length !== 1) {
      throw new BadRequestError('exactly one image file is required');
    }

    const kindResult = RemoverUploadKindSchema.safeParse(formData.get('kind'));
    if (!kindResult.success) {
      throw new BadRequestError('invalid remover image kind');
    }

    const storageService = await deps.getStorageService();
    const { asset, anonymousSessionId } = await uploadRemoverImage({
      actor,
      file: files[0]!,
      kind: kindResult.data,
      width: parseDimension(formData, 'width'),
      height: parseDimension(formData, 'height'),
      deps: {
        storageService,
        createAsset: deps.createAsset,
        reserveUploadQuota: deps.reserveUploadQuota,
        commitReservation: deps.commitReservation,
        refundReservation: deps.refundReservation,
        detectImageMime: deps.detectImageMime,
        acquireGuestIpLimit: deps.acquireGuestIpLimit
          ? async (limitActor) =>
              deps.acquireGuestIpLimit
                ? deps.acquireGuestIpLimit({ actor: limitActor, req })
                : undefined
          : undefined,
      },
    });

    api.log.info('remover: image uploaded', {
      assetId: asset.id,
      kind: asset.kind,
    });

    return jsonOk(
      {
        asset: {
          id: asset.id,
          kind: asset.kind,
        },
        anonymousSessionId,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  };
}
