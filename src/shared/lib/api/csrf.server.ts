/**
 * CSRF guard for cookie-based authenticated requests.
 *
 * Scope:
 * - Only checks "unsafe" methods: POST/PUT/PATCH/DELETE
 * - Only when request carries cookies
 *
 * Strategy:
 * - Compare Origin/Referer host with Host (and configured APP_URL host).
 * - X-Forwarded-Host is only used as a fallback when Host is missing.
 * - Reject if missing or mismatched.
 */


import { getRequestLogger } from '@/infra/platform/logging/request-logger.server';
import { site } from '@/site';

import { ForbiddenError } from './errors';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeHeaderValue(value: string | null): string | null {
  const trimmed = value?.trim() || '';
  return trimmed ? trimmed : null;
}

function firstForwardedHost(value: string): string {
  const [first] = value.split(',');
  return (first || value).trim();
}

function expectedHostFromRequest(req: Request): string | null {
  const host = normalizeHeaderValue(req.headers.get('host'));
  if (host) {
    return firstForwardedHost(host);
  }

  try {
    const urlHost = new URL(req.url).host;
    if (urlHost) return urlHost;
  } catch {
    // ignore URL parse errors
  }

  const forwardedHost = normalizeHeaderValue(
    req.headers.get('x-forwarded-host')
  );
  if (forwardedHost) {
    return firstForwardedHost(forwardedHost);
  }

  return null;
}

function originOrReferer(req: Request): string | null {
  const origin = normalizeHeaderValue(req.headers.get('origin'));
  if (origin && origin !== 'null') return origin;

  const referer = normalizeHeaderValue(req.headers.get('referer'));
  if (referer) return referer;

  return origin;
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

function appHost(): string | null {
  try {
    return new URL(site.brand.appUrl).host || null;
  } catch {
    return null;
  }
}

function shouldCheckCsrf(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (!WRITE_METHODS.has(method)) return false;
  return req.headers.has('cookie');
}

function logCsrfRejected(req: Request, meta: Record<string, unknown>): void {
  try {
    const { log } = getRequestLogger(req);
    log.warn('[api] csrf rejected', meta);
  } catch {
    // ignore logging errors
  }
}

export function assertCsrf(req: Request): void {
  if (!shouldCheckCsrf(req)) return;

  const originHeader = normalizeHeaderValue(req.headers.get('origin'));
  const refererHeader = normalizeHeaderValue(req.headers.get('referer'));
  const source = originOrReferer(req);
  if (!source || source === 'null') {
    logCsrfRejected(req, {
      reason: 'missing_origin_or_referer',
      origin: originHeader,
      refererHost: refererHeader ? hostFromUrl(refererHeader) : null,
    });
    throw new ForbiddenError('csrf check failed');
  }

  const sourceHost = hostFromUrl(source);
  if (!sourceHost) {
    logCsrfRejected(req, {
      reason: 'invalid_origin_or_referer',
      origin: originHeader,
      refererHost: refererHeader ? hostFromUrl(refererHeader) : null,
    });
    throw new ForbiddenError('csrf check failed');
  }

  const allowedHosts = new Set<string>();

  const expectedHost = expectedHostFromRequest(req);
  if (expectedHost) {
    allowedHosts.add(expectedHost);
  }

  const configuredAppHost = appHost();
  if (configuredAppHost) {
    allowedHosts.add(configuredAppHost);
  }

  if (allowedHosts.size === 0 || !allowedHosts.has(sourceHost)) {
    logCsrfRejected(req, {
      reason: 'origin_host_mismatch',
      sourceHost,
      expectedHost,
      configuredAppHost,
    });
    throw new ForbiddenError('csrf check failed');
  }
}
