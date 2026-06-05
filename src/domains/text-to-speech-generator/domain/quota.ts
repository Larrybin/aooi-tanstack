import {
  getProductQuotaWindowStart,
  type ProductQuotaReservationStatus,
} from '@/domains/product-quota/domain/reservation';

import type {
  TextToSpeechQuotaOperationKey,
  TextToSpeechQuotaReservationStatus,
} from './types';

export const TEXT_TO_SPEECH_QUOTA_OPERATION_KEYS = {
  speechGenerate: 'speech.generate',
} as const satisfies Record<string, TextToSpeechQuotaOperationKey>;

export function getTextToSpeechQuotaWindowStart(now: Date): Date {
  return getProductQuotaWindowStart(now, 'month');
}

export function addTextToSpeechQuotaReservationMinutes(
  now: Date,
  minutes: number
): Date {
  return new Date(now.getTime() + Math.max(1, minutes) * 60 * 1000);
}

export function toTextToSpeechQuotaReservationStatus(
  status: ProductQuotaReservationStatus
): TextToSpeechQuotaReservationStatus {
  return status;
}
