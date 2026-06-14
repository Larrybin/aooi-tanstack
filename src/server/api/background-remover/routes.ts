import {
  createBackgroundRemoverImage,
  findBackgroundRemoverImageByIdForOwner,
  listExpiredBackgroundRemoverImages,
  markBackgroundRemoverImagesDeletedByIds,
} from '@/domains/background-remover/infra/image';
import {
  commitBackgroundRemoverQuotaReservation,
  refundBackgroundRemoverQuotaReservation,
  reserveBackgroundRemoverQuota,
} from '@/domains/background-remover/infra/quota';
import { getStorageService } from '@/infra/adapters/storage/service';
import {
  getCloudflareImagesBinding,
  getRuntimeEnvString,
} from '@/infra/runtime/env.server';

import { resolveBackgroundRemoverActor } from './actor';
import { requireBackgroundRemoverSite } from './guard';
import { createBackgroundRemoverRoutes } from './routes-core';

const routes = createBackgroundRemoverRoutes({
  commitReservation: commitBackgroundRemoverQuotaReservation,
  createImage: createBackgroundRemoverImage,
  findImageByIdForOwner: findBackgroundRemoverImageByIdForOwner,
  getImagesBinding: getCloudflareImagesBinding,
  getRuntimeEnvString,
  getStorageService,
  listExpiredImages: listExpiredBackgroundRemoverImages,
  markImagesDeletedByIds: markBackgroundRemoverImagesDeletedByIds,
  refundReservation: refundBackgroundRemoverQuotaReservation,
  requireSite: requireBackgroundRemoverSite,
  reserveQuota: reserveBackgroundRemoverQuota,
  resolveActor: resolveBackgroundRemoverActor,
});

export const getBackgroundRemoverDownload = routes.getBackgroundRemoverDownload;
export const getBackgroundRemoverResult = routes.getBackgroundRemoverResult;
export const postBackgroundRemoverCleanup = routes.postBackgroundRemoverCleanup;
export const postBackgroundRemoverRemove = routes.postBackgroundRemoverRemove;
