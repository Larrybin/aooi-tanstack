import { ConflictError, TooManyRequestsError } from '@/shared/lib/api/errors';

export type ProductQuotaWindow = 'day' | 'month';
export type ProductQuotaReservationStatus =
  | 'reserved'
  | 'committed'
  | 'refunded';

export type ProductQuotaReservationLike = {
  status: ProductQuotaReservationStatus;
};

export function getProductQuotaWindowStart(
  now: Date,
  window: ProductQuotaWindow
): Date {
  if (window === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export function assertProductQuotaAvailable({
  usedUnits,
  requestedUnits,
  limit,
  quotaExceededMessage = 'product quota exceeded',
}: {
  usedUnits: number;
  requestedUnits: number;
  limit: number;
  quotaExceededMessage?: string;
}): void {
  if (requestedUnits <= 0) {
    throw new ConflictError('quota units must be positive');
  }

  if (limit < requestedUnits || usedUnits + requestedUnits > limit) {
    throw new TooManyRequestsError(quotaExceededMessage, {
      limit,
      usedUnits,
      requestedUnits,
    });
  }
}

export function isProductQuotaReservationReusable({
  status,
  expiresAt,
  now = new Date(),
}: {
  status: ProductQuotaReservationStatus | string;
  expiresAt: Date;
  now?: Date;
}): boolean {
  if (status === 'committed') {
    return true;
  }

  return status === 'reserved' && expiresAt > now;
}

export function commitProductQuotaReservation<
  T extends ProductQuotaReservationLike,
>(reservation: T): ProductQuotaReservationStatus {
  if (reservation.status === 'committed') {
    return 'committed';
  }

  if (reservation.status === 'refunded') {
    throw new ConflictError('quota reservation was already refunded');
  }

  return 'committed';
}

export function refundProductQuotaReservation<
  T extends ProductQuotaReservationLike,
>(reservation: T): ProductQuotaReservationStatus {
  if (reservation.status === 'refunded') {
    return 'refunded';
  }

  if (reservation.status === 'committed') {
    throw new ConflictError('quota reservation was already committed');
  }

  return 'refunded';
}
