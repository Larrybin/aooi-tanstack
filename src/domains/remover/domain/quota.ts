import { ConflictError, TooManyRequestsError } from '@/shared/lib/api/errors';

import type {
  RemoverQuotaReservationLike,
  RemoverQuotaReservationStatus,
} from './types';

export function getQuotaWindowStart(now: Date, window: 'day' | 'month'): Date {
  if (window === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
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
  if (requestedUnits <= 0) {
    throw new ConflictError('quota units must be positive');
  }

  if (limit < requestedUnits || usedUnits + requestedUnits > limit) {
    throw new TooManyRequestsError('remover quota exceeded', {
      limit,
      usedUnits,
      requestedUnits,
    });
  }
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
  if (status === 'committed') {
    return true;
  }

  return status === 'reserved' && expiresAt > now;
}

export function commitQuotaReservation<T extends RemoverQuotaReservationLike>(
  reservation: T
): RemoverQuotaReservationStatus {
  if (reservation.status === 'committed') {
    return 'committed';
  }

  if (reservation.status === 'refunded') {
    throw new ConflictError('quota reservation was already refunded');
  }

  return 'committed';
}

export function refundQuotaReservation<T extends RemoverQuotaReservationLike>(
  reservation: T
): RemoverQuotaReservationStatus {
  if (reservation.status === 'refunded') {
    return 'refunded';
  }

  if (reservation.status === 'committed') {
    throw new ConflictError('quota reservation was already committed');
  }

  return 'refunded';
}
