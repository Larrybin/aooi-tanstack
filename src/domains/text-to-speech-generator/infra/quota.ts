import 'server-only';

import type { ProductActor } from '@/domains/product-access/domain/actor';
import {
  reserveProductQuota,
  type ProductQuotaCheck,
  type ProductQuotaReservationDraft,
} from '@/domains/product-quota/application/quota-service';
import {
  commitProductQuotaReservationById,
  countActiveProductQuotaUnits,
  refundProductQuotaReservationById,
  reserveProductQuotaReservationWithQuotaCheck,
  toProductQuotaReservationInsert,
  type NewProductQuotaReservation,
  type ProductQuotaReservation,
  type ProductQuotaReservationCheck,
} from '@/domains/product-quota/infra/reservation';

import { TEXT_TO_SPEECH_GENERATOR_SITE_KEY } from '../domain/config';
import { TEXT_TO_SPEECH_QUOTA_OPERATION_KEYS } from '../domain/quota';
import type { TextToSpeechQuotaOperationKey } from '../domain/types';

export type TextToSpeechQuotaReservation = ProductQuotaReservation;
export type NewTextToSpeechQuotaReservation = NewProductQuotaReservation;
export type TextToSpeechQuotaReservationCheck = ProductQuotaReservationCheck;

export type ReserveTextToSpeechQuotaInput = {
  actor: ProductActor;
  productId: string;
  operationKey: TextToSpeechQuotaOperationKey;
  units: number;
  limit: number;
  windowStart: Date;
  idempotencyKey: string;
  expiresAt: Date;
  reason?: string | null;
  entitlementGrantIdsJson?: string | null;
  now?: Date;
  createId?: () => string;
};

export function toTextToSpeechQuotaReservationInsert(
  reservation: ProductQuotaReservationDraft
): NewTextToSpeechQuotaReservation {
  return toProductQuotaReservationInsert(reservation);
}

export function toTextToSpeechQuotaCheck(
  quota: ProductQuotaCheck
): TextToSpeechQuotaReservationCheck {
  return {
    userId: quota.userId,
    anonymousSessionId: quota.anonymousSessionId,
    siteKey: quota.siteKey,
    productKey: quota.productKey,
    operationKey: quota.operationKey,
    windowStart: quota.windowStart,
    limit: quota.limit,
    requestedUnits: quota.requestedUnits,
    now: quota.now,
    quotaExceededMessage: 'text to speech quota exceeded',
  };
}

export async function reserveTextToSpeechQuota(
  input: ReserveTextToSpeechQuotaInput
): Promise<{ reservation: TextToSpeechQuotaReservation; reused: boolean }> {
  return reserveProductQuota({
    actor: input.actor,
    siteKey: TEXT_TO_SPEECH_GENERATOR_SITE_KEY,
    productKey: TEXT_TO_SPEECH_GENERATOR_SITE_KEY,
    productId: input.productId,
    operationKey: input.operationKey,
    units: input.units,
    limit: input.limit,
    windowStart: input.windowStart,
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
    reason: input.reason,
    entitlementGrantIdsJson: input.entitlementGrantIdsJson,
    now: input.now,
    createId: input.createId,
    quotaExceededMessage: 'text to speech quota exceeded',
    deps: {
      reserve: ({ reservation, quota }) =>
        reserveProductQuotaReservationWithQuotaCheck({
          reservation: toTextToSpeechQuotaReservationInsert(reservation),
          quota: toTextToSpeechQuotaCheck(quota),
        }),
    },
  });
}

export async function countTextToSpeechMonthlyQuotaUnits({
  userId,
  windowStart,
  now,
}: {
  userId: string;
  windowStart: Date;
  now?: Date;
}): Promise<number> {
  return countActiveProductQuotaUnits({
    userId,
    anonymousSessionId: null,
    siteKey: TEXT_TO_SPEECH_GENERATOR_SITE_KEY,
    productKey: TEXT_TO_SPEECH_GENERATOR_SITE_KEY,
    operationKey: TEXT_TO_SPEECH_QUOTA_OPERATION_KEYS.speechGenerate,
    windowStart,
    now,
  });
}

export const commitTextToSpeechQuotaReservation =
  commitProductQuotaReservationById;

export const refundTextToSpeechQuotaReservation =
  refundProductQuotaReservationById;
