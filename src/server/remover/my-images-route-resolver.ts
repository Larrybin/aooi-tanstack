import { readAnonymousSessionIdFromRequest } from '@/domains/remover/application/actor-session';
import { deleteRemoverJobImagesForUser } from '@/domains/remover/application/delete-image';
import { listMyRemoverJobsForActor } from '@/domains/remover/application/jobs';
import {
  claimRemoverImageAssetsByKeys,
  markRemoverImageAssetsDeletedByKeys,
} from '@/domains/remover/infra/image-asset';
import {
  claimRemoverJobById,
  findRemoverJobById,
  listRemoverJobsForOwner,
  markRemoverJobDeletedById,
} from '@/domains/remover/infra/job';
import { claimRemoverQuotaReservationById } from '@/domains/remover/infra/quota-reservation';
import { getStorageService } from '@/infra/adapters/storage/service';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';
import { resolveLandingShellData } from '@/server/landing/landing-shell-data';
import {
  loadMyImagesRouteCopy,
  type MyImagesRouteCopy,
} from '@/server/remover/my-images-route-copy';
import type { SlugShellData } from '@/surfaces/landing/slug/slug.types';
import { getRequest } from '@tanstack/react-start/server';

import { normalizeLocale } from '@/shared/i18n/locale';

export type MyImagesJob = {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  previewUrl: string;
  hasOutput: boolean;
};

export type MyImagesRouteData = {
  locale: string;
  signedIn: boolean;
  jobs: MyImagesJob[];
  copy: MyImagesRouteCopy;
  shell: SlugShellData;
};

async function resolveAnonymousSessionId(request: Request) {
  const secret =
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    '';
  return readAnonymousSessionIdFromRequest(request, { secret });
}

export async function resolveMyImagesRouteData(data: {
  locale: string;
}): Promise<MyImagesRouteData | null> {
  const request = getRequest();
  const user = await getSignedInUserIdentityFromRequest(request);
  const locale = normalizeLocale(data.locale);
  if (!locale) return null;
  const copy = await loadMyImagesRouteCopy(locale);
  const shell = resolveLandingShellData(locale);
  if (!user) return { locale, signedIn: false, jobs: [], copy, shell };
  const anonymousSessionId = await resolveAnonymousSessionId(request);
  const jobs = await listMyRemoverJobsForActor({
    actor: {
      kind: 'user',
      userId: user.id,
      anonymousSessionId,
      productId: 'free',
    },
    limit: 30,
    deps: {
      listJobsForOwner: listRemoverJobsForOwner,
      claimJobById: claimRemoverJobById,
      claimAssetsByKeys: claimRemoverImageAssetsByKeys,
      claimReservationById: claimRemoverQuotaReservationById,
    },
  });
  return {
    locale,
    signedIn: true,
    copy,
    shell,
    jobs: jobs.map((job) => ({
      id: job.id,
      status: job.status ?? '',
      createdAt:
        job.createdAt instanceof Date
          ? job.createdAt.toISOString()
          : String(job.createdAt),
      expiresAt:
        job.expiresAt instanceof Date
          ? job.expiresAt.toISOString()
          : String(job.expiresAt),
      previewUrl: job.outputImageKey
        ? `/api/remover/download/low-res?jobId=${encodeURIComponent(job.id)}`
        : '',
      hasOutput: Boolean(job.outputImageKey),
    })),
  };
}

export async function removeMyImagesJob(request: Request) {
  const user = await getSignedInUserIdentityFromRequest(request);
  if (!user) return new Response('Unauthorized', { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as {
    jobId?: string;
  };
  const jobId = payload.jobId?.trim();
  if (!jobId) return new Response('Missing jobId', { status: 400 });
  await deleteRemoverJobImagesForUser({
    jobId,
    userId: user.id,
    deps: {
      findJobById: findRemoverJobById,
      getStorageService,
      markJobDeleted: markRemoverJobDeletedById,
      markAssetsDeleted: markRemoverImageAssetsDeletedByKeys,
    },
  });
  return new Response(null, { status: 204 });
}
