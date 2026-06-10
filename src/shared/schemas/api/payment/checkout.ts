/**
 * Usage: `parseJson(req, PaymentCheckoutBodySchema)`
 */

import { z } from 'zod';

import { locales, type Locale } from '@/config/locale';

export const PaymentCheckoutBodySchema = z
  .object({
    product_id: z.string().min(1),
    currency: z.string().min(1).optional(),
    locale: z
      .string()
      .trim()
      .min(1)
      .transform((value) => (value === 'zh-CN' ? 'zh' : value))
      .refine((value) => locales.includes(value as Locale), {
        message: 'unsupported locale',
      })
      .optional(),
  })
  .strict();

export type PaymentCheckoutBody = z.infer<typeof PaymentCheckoutBodySchema>;
