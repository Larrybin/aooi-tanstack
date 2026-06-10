import { PaymentType } from '@/domains/billing/domain/payment';

import { AIMediaType } from '@/extensions/ai';

export const ADMIN_AI_TASK_MEDIA_TYPES = [
  AIMediaType.MUSIC,
  AIMediaType.IMAGE,
  AIMediaType.VIDEO,
  AIMediaType.TEXT,
  AIMediaType.SPEECH,
] as const;

export const ADMIN_CREDIT_TRANSACTION_TYPES = ['grant', 'consume'] as const;

export const ADMIN_PAYMENT_TYPES = [
  PaymentType.SUBSCRIPTION,
  PaymentType.ONE_TIME,
] as const;

export const ADMIN_PAYMENT_STATUSES = ['paid', 'created', 'failed'] as const;

export const ADMIN_PAYMENT_PROVIDERS = ['stripe', 'creem', 'paypal'] as const;
