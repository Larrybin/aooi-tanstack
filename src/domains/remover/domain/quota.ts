import {
  assertProductQuotaAvailable,
  commitProductQuotaReservation,
  getProductQuotaWindowStart,
  isProductQuotaReservationReusable,
  refundProductQuotaReservation,
} from '@/domains/product-quota/domain/reservation';

import type {
  RemoverQuotaOperationKey,
  RemoverQuotaReservationLike,
  RemoverQuotaReservationStatus,
  RemoverQuotaType,
} from './types';

export function getQuotaWindowStart(now: Date, window: 'day' | 'month'): Date {
  return getProductQuotaWindowStart(now, window);
}

export function assertQuotaAvailable({
  usedUnits,
  requestedUnits,
  limit,
}: {
  usedUnits: number;
  requestedUnits: number;
  limit: number;
}): void {
  assertProductQuotaAvailable({
    usedUnits,
    requestedUnits,
    limit,
    quotaExceededMessage: 'remover quota exceeded',
  });
}

export function isQuotaReservationReusable({
  status,
  expiresAt,
  now = new Date(),
}: {
  status: RemoverQuotaReservationStatus | string;
  expiresAt: Date;
  now?: Date;
}): boolean {
  return isProductQuotaReservationReusable({ status, expiresAt, now });
}

export function commitQuotaReservation<T extends RemoverQuotaReservationLike>(
  reservation: T
): RemoverQuotaReservationStatus {
  return commitProductQuotaReservation(reservation);
}

export function refundQuotaReservation<T extends RemoverQuotaReservationLike>(
  reservation: T
): RemoverQuotaReservationStatus {
  return refundProductQuotaReservation(reservation);
}

export const REMOVER_QUOTA_OPERATION_KEYS = {
  uploadCreate: 'upload.create',
  imageRemove: 'image.remove',
  imageHdDownload: 'image.hd_download',
} as const satisfies Record<string, RemoverQuotaOperationKey>;

const REMOVER_QUOTA_TYPE_BY_OPERATION_KEY = {
  [REMOVER_QUOTA_OPERATION_KEYS.uploadCreate]: 'upload',
  [REMOVER_QUOTA_OPERATION_KEYS.imageRemove]: 'processing',
  [REMOVER_QUOTA_OPERATION_KEYS.imageHdDownload]: 'high_res_download',
} as const satisfies Record<RemoverQuotaOperationKey, RemoverQuotaType>;

export function getRemoverQuotaTypeForOperationKey(
  operationKey: RemoverQuotaOperationKey
): RemoverQuotaType {
  return REMOVER_QUOTA_TYPE_BY_OPERATION_KEY[operationKey];
}
