import type { ApiContext } from '@/app/api/_lib/context';
import type {
  reserveHighResDownloadQuota,
  resolveRemoverDownload,
} from '@/domains/remover/application/download';
import type { RemoverActor } from '@/domains/remover/domain/types';
import type { getStorageService } from '@/infra/adapters/storage/service';

import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '@/shared/lib/api/errors';
import { RemoverDownloadBodySchema } from '@/shared/schemas/api/remover';

type DownloadActionDeps = {
  createApiContext: (req: Request) => ApiContext;
  resolveActor: (req: Request) => Promise<RemoverActor>;
  resolveDownload: typeof resolveRemoverDownload;
  reserveHighResQuota: typeof reserveHighResDownloadQuota;
  getStorageService: typeof getStorageService;
  downloadDeps: Parameters<typeof resolveRemoverDownload>[0]['deps'];
};

function contentDisposition(filename: string): string {
  const safeFilename = filename.replace(/["\r\n]/gu, '_');
  return `attachment; filename="${safeFilename}"`;
}

export function createRemoverDownloadPostAction(
  deps: DownloadActionDeps,
  variant: 'low_res' | 'high_res'
) {
  return async (req: Request) => {
    const api = deps.createApiContext(req);
    const actor = await deps.resolveActor(req);
    const body = await api.parseJson(RemoverDownloadBodySchema);
    const download = await deps.resolveDownload({
      actor,
      jobId: body.jobId,
      variant,
      deps: deps.downloadDeps,
    });
    const storage = await deps.getStorageService();
    const file = await storage.getFile(download.storageKey);
    if (!file?.body) {
      throw new NotFoundError('remover output image not found');
    }
    let quotaReservationIdToCommit: string | undefined =
      download.quotaReservationIdToCommit;
    if (download.requiresHighResQuota) {
      if (actor.kind !== 'user') {
        throw new ForbiddenError('sign in to download high-res results');
      }
      quotaReservationIdToCommit = await deps.reserveHighResQuota({
        actor,
        job: download.job,
        deps: deps.downloadDeps,
      });
    }
    if (quotaReservationIdToCommit) {
      await deps.downloadDeps.commitReservation({
        reservationId: quotaReservationIdToCommit,
      });
    }

    return new Response(file.body, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': file.contentType,
        'Content-Disposition': contentDisposition(download.filename),
        ...(file.contentLength
          ? { 'Content-Length': String(file.contentLength) }
          : {}),
      },
    });
  };
}

export function createRemoverDownloadGetAction(
  deps: DownloadActionDeps,
  variant: 'low_res'
) {
  return async (req: Request) => {
    const actor = await deps.resolveActor(req);
    const jobId = new URL(req.url).searchParams.get('jobId')?.trim() || '';
    if (!jobId) {
      throw new BadRequestError('jobId is required');
    }

    const download = await deps.resolveDownload({
      actor,
      jobId,
      variant,
      deps: deps.downloadDeps,
    });
    const storage = await deps.getStorageService();
    const file = await storage.getFile(download.storageKey);
    if (!file?.body) {
      throw new NotFoundError('remover output image not found');
    }

    return new Response(file.body, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': file.contentType,
        ...(file.contentLength
          ? { 'Content-Length': String(file.contentLength) }
          : {}),
      },
    });
  };
}
