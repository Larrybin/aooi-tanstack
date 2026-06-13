import { z } from 'zod';

import {
  nonEmptyTrimmedStringSchema,
  optionalTrimmedStringSchema,
} from './common';

export function isSafeProfileImageValue(value: string) {
  const image = value.trim();
  if (!image) {
    return true;
  }

  if (image.startsWith('/') && !image.startsWith('//')) {
    return true;
  }

  try {
    const url = new URL(image);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeProfileImageValue(value: unknown) {
  const image = typeof value === 'string' ? value.trim() : '';
  return isSafeProfileImageValue(image) ? image : null;
}

export const SettingsProfileFormSchema = z.object({
  name: nonEmptyTrimmedStringSchema,
  image: optionalTrimmedStringSchema.refine(
    (value) => value === undefined || isSafeProfileImageValue(value)
  ),
});
