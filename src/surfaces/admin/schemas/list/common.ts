import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 200;

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function normalizeQueryString(value: unknown): string | undefined {
  const current = firstQueryValue(value);

  if (current == null) {
    return undefined;
  }

  const normalized = String(current).trim();
  return normalized ? normalized : undefined;
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const normalized = normalizeQueryString(value);
  if (!normalized) {
    return fallback;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export const adminPageQuerySchema = z
  .preprocess(
    (value) => normalizePositiveInt(value, DEFAULT_PAGE),
    z.number().int().min(1)
  )
  .default(DEFAULT_PAGE);

export const adminPageSizeQuerySchema = z
  .preprocess(
    (value) =>
      Math.min(normalizePositiveInt(value, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    z.number().int().min(1).max(MAX_PAGE_SIZE)
  )
  .default(DEFAULT_PAGE_SIZE);

export const adminPaginationQuerySchema = z.object({
  page: adminPageQuerySchema,
  pageSize: adminPageSizeQuerySchema,
});

export function createOptionalEnumQuerySchema<
  const TValues extends readonly [string, ...string[]],
>(values: TValues) {
  return z.preprocess((value) => {
    const normalized = normalizeQueryString(value);
    if (!normalized || normalized === 'all') {
      return undefined;
    }

    if (values.includes(normalized as TValues[number])) {
      return normalized;
    }

    return undefined;
  }, z.enum(values).optional());
}

export const optionalTrimmedQueryStringSchema = z.preprocess((value) => {
  return normalizeQueryString(value);
}, z.string().optional());

export const booleanFlagQuerySchema = z.preprocess((value) => {
  const normalized = normalizeQueryString(value)?.toLowerCase();
  return normalized === '1' || normalized === 'true';
}, z.boolean());
