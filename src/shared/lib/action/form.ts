
import { z } from 'zod';

import { tryJsonParse } from '@/shared/lib/json';

import { ActionError } from './errors';

function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key in out) {
      const existing = out[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        out[key] = [existing, value];
      }
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function parseFormData<TSchema extends z.ZodTypeAny>(
  formData: FormData,
  schema: TSchema,
  options?: { message?: string }
): z.infer<TSchema> {
  const value = formDataToObject(formData);
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ActionError(options?.message ?? 'invalid params');
  }
  return result.data;
}

export const jsonStringArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  const parsed = tryJsonParse<unknown>(value);
  return parsed.ok ? parsed.value : value;
}, z.array(z.string()));
