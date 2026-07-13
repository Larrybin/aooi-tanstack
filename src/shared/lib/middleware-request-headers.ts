const MIDDLEWARE_NEXT_HEADER = 'x-middleware-next';
const MIDDLEWARE_REWRITE_HEADER = 'x-middleware-rewrite';

const MIDDLEWARE_OVERRIDE_HEADERS = 'x-middleware-override-headers';
const MIDDLEWARE_REQUEST_HEADER_PREFIX = 'x-middleware-request-';

function isContinuingMiddlewareResponse(responseHeaders: Headers): boolean {
  return (
    responseHeaders.has(MIDDLEWARE_NEXT_HEADER) ||
    responseHeaders.has(MIDDLEWARE_REWRITE_HEADER)
  );
}

function parseOverrideHeaders(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }

  return result;
}

/**
 * Upserts a single upstream request header override for router middleware.
 *
 * `X-NEXT-INTL-LOCALE`) by merging with the current `x-middleware-override-headers`
 * instead of overwriting it.
 */
export function upsertMiddlewareRequestHeader(
  responseHeaders: Headers,
  headerName: string,
  headerValue: string
): void {
  const trimmedName = headerName.trim();
  if (!trimmedName) return;

  if (!isContinuingMiddlewareResponse(responseHeaders)) return;

  const existingOverrideHeaders = parseOverrideHeaders(
    responseHeaders.get(MIDDLEWARE_OVERRIDE_HEADERS)
  );

  const targetLower = trimmedName.toLowerCase();
  const existingEntry = existingOverrideHeaders.find(
    (name) => name.toLowerCase() === targetLower
  );
  const canonicalName = existingEntry ?? targetLower;

  responseHeaders.set(
    `${MIDDLEWARE_REQUEST_HEADER_PREFIX}${canonicalName}`,
    headerValue
  );

  if (existingEntry) return;

  const merged = dedupeCaseInsensitive([
    ...existingOverrideHeaders,
    canonicalName,
  ]);
  responseHeaders.set(MIDDLEWARE_OVERRIDE_HEADERS, merged.join(','));
}
