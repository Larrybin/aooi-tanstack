import { isRuntimeEnvEnabled } from '@/infra/runtime/env.server';
import { isCloudflareLocalWorkersDevRuntime } from '@/infra/runtime/runtime-mode';

import type { EnvLike } from '@/config/env-contract';

function normalizeAuthOrigin(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('must use http or https');
    }
    return url.origin;
  } catch (error) {
    throw new Error(`Invalid ${label} origin: ${value} (${String(error)})`);
  }
}

function normalizeAllowedAuthOrigins(
  canonicalAppUrl: string,
  additionalAllowedOrigins: string[] | undefined,
  label: string
): string[] {
  const origins = [normalizeAuthOrigin(canonicalAppUrl, label)];

  for (const origin of additionalAllowedOrigins || []) {
    const normalizedOrigin = normalizeAuthOrigin(
      origin,
      'additional auth origin'
    );
    if (!origins.includes(normalizedOrigin)) {
      origins.push(normalizedOrigin);
    }
  }

  return origins;
}

function tryNormalizeAuthOrigin(
  value: string | null | undefined
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return normalizeAuthOrigin(trimmed, 'request origin');
  } catch {
    return null;
  }
}

function addOriginCandidate(candidates: string[], value: string | null) {
  if (value && !candidates.includes(value)) {
    candidates.push(value);
  }
}

function shouldPrintAuthOriginDebug(): boolean {
  return isRuntimeEnvEnabled('CF_LOCAL_AUTH_DEBUG');
}

function printAuthOriginDebug(
  label: string,
  params: {
    allowedOrigins?: string[];
    candidates?: string[];
    origin?: string;
    request?: Request;
  }
) {
  if (!shouldPrintAuthOriginDebug()) {
    return;
  }

  const request = params.request;
  const debugPayload = {
    allowedOrigins: params.allowedOrigins || [],
    origin: params.origin || null,
    candidates: params.candidates || [],
    requestUrl: request?.url || null,
    requestOrigin: request?.headers.get('origin') || null,
    requestHost: request?.headers.get('host') || null,
    requestForwardedHost: request?.headers.get('x-forwarded-host') || null,
    requestForwardedProto: request?.headers.get('x-forwarded-proto') || null,
    requestReferer: request?.headers.get('referer') || null,
  };
  process.stderr.write(
    `[auth-debug] ${label} ${JSON.stringify(debugPayload)}\n`
  );
}

function isCanonicalHttpPreviewVariant(
  origin: string,
  canonicalOrigin: string
) {
  try {
    const runtimeUrl = new URL(origin);
    const canonicalUrl = new URL(canonicalOrigin);

    return (
      runtimeUrl.protocol === 'http:' &&
      canonicalUrl.protocol === 'https:' &&
      !isLocalAuthHost(canonicalUrl.host) &&
      runtimeUrl.host === canonicalUrl.host
    );
  } catch {
    return false;
  }
}

function isPortlessLocalPreviewVariant(
  origin: string,
  canonicalOrigin: string
) {
  try {
    const runtimeUrl = new URL(origin);
    const canonicalUrl = new URL(canonicalOrigin);

    return (
      runtimeUrl.protocol === 'http:' &&
      canonicalUrl.protocol === 'http:' &&
      runtimeUrl.hostname === canonicalUrl.hostname &&
      !runtimeUrl.port &&
      !!canonicalUrl.port &&
      isLocalAuthHost(runtimeUrl.host) &&
      isLocalAuthHost(canonicalUrl.host)
    );
  } catch {
    return false;
  }
}

function normalizeAllowedRuntimeOrigin(
  origin: string,
  allowedOrigins: string[]
) {
  for (const allowedOrigin of allowedOrigins) {
    if (
      isCanonicalHttpPreviewVariant(origin, allowedOrigin) ||
      isPortlessLocalPreviewVariant(origin, allowedOrigin)
    ) {
      return allowedOrigin;
    }
  }

  return origin;
}

function readRequestHostOrigin(request: Request): string | null {
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host?.trim()) {
    return null;
  }

  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (isLocalAuthHost(host) ? 'http' : tryReadUrlProtocol(request.url)) ||
    'http';

  return tryNormalizeAuthOrigin(`${protocol}://${host}`);
}

function isLocalAuthHost(host: string): boolean {
  const hostname = host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function tryReadUrlProtocol(value: string): string | null {
  try {
    const protocol = new URL(value).protocol.replace(/:$/, '');
    return protocol === 'http' || protocol === 'https' ? protocol : null;
  } catch {
    return null;
  }
}

export function isLocalAuthRuntimeOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export function isExplicitLocalAuthRuntimeEnabled(
  params: {
    env?: EnvLike;
    preferRequestOrigin?: boolean;
  } = {}
): boolean {
  const env = params.env;
  return (
    (env
      ? isCloudflareLocalWorkersDevRuntime(env)
      : isRuntimeEnvEnabled('CF_LOCAL_SMOKE_WORKERS_DEV')) ||
    (env
      ? env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK === 'true'
      : isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK')) ||
    params.preferRequestOrigin === true
  );
}

function resolveAllowedRuntimeOrigin(
  origin: string,
  allowedOrigins: string[],
  allowLocalOrigin: boolean,
  request?: Request,
  candidates?: string[]
): string | null {
  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  if (isLocalAuthRuntimeOrigin(origin)) {
    return allowLocalOrigin ? origin : null;
  }

  printAuthOriginDebug('reject-runtime-origin', {
    allowedOrigins,
    origin,
    request,
    candidates,
  });

  throw new Error(
    `Unexpected runtime auth origin: ${origin}. Expected one of ${allowedOrigins.join(', ')}${allowLocalOrigin ? ' or localhost/127.0.0.1 preview origin' : ''}.`
  );
}

function readRequestOriginCandidates(request?: Request): string[] {
  if (!request) {
    return [];
  }

  const candidates: string[] = [];
  addOriginCandidate(
    candidates,
    tryNormalizeAuthOrigin(request.headers.get('origin'))
  );
  addOriginCandidate(candidates, readRequestHostOrigin(request));

  if (candidates.length === 0) {
    addOriginCandidate(candidates, tryNormalizeAuthOrigin(request.url));
  }

  printAuthOriginDebug('read-request-origin-candidates', {
    candidates,
    request,
  });

  return candidates;
}

export function readRequestOrigin(request?: Request): string | null {
  return readRequestOriginCandidates(request)[0] || null;
}

export function buildTrustedAuthOrigins(params: {
  appUrl: string;
  additionalAllowedOrigins?: string[];
  request?: Request;
  preferRequestOrigin?: boolean;
  env?: EnvLike;
}): string[] {
  const allowedOrigins = normalizeAllowedAuthOrigins(
    params.appUrl,
    params.additionalAllowedOrigins,
    'site.brand.appUrl'
  );
  const allowLocalOrigin = isExplicitLocalAuthRuntimeEnabled({
    env: params.env,
    preferRequestOrigin: params.preferRequestOrigin,
  });
  const origins = new Set<string>(allowedOrigins);

  if (allowLocalOrigin) {
    origins.add('http://127.0.0.1:8787');
    origins.add('http://localhost:8787');
  }

  const requestOriginCandidates = readRequestOriginCandidates(params.request);

  for (const requestOrigin of requestOriginCandidates) {
    if (allowLocalOrigin && isLocalAuthRuntimeOrigin(requestOrigin)) {
      origins.add(requestOrigin);
    }

    const normalizedRequestOrigin = normalizeAllowedRuntimeOrigin(
      requestOrigin,
      allowedOrigins
    );
    const resolvedRequestOrigin = resolveAllowedRuntimeOrigin(
      normalizedRequestOrigin,
      allowedOrigins,
      allowLocalOrigin,
      params.request,
      requestOriginCandidates
    );
    if (resolvedRequestOrigin) {
      origins.add(resolvedRequestOrigin);
    }
  }

  origins.add('https://accounts.google.com');
  return [...origins];
}

export function resolveRuntimeAuthBaseUrl(params: {
  defaultBaseUrl: string;
  additionalAllowedOrigins?: string[];
  preferRequestOrigin?: boolean;
  request?: Request;
  env?: EnvLike;
}): string {
  const allowedOrigins = normalizeAllowedAuthOrigins(
    params.defaultBaseUrl,
    params.additionalAllowedOrigins,
    'default auth base URL'
  );
  const allowLocalOrigin = isExplicitLocalAuthRuntimeEnabled({
    env: params.env,
    preferRequestOrigin: params.preferRequestOrigin,
  });
  const canonicalOrigin = allowedOrigins[0];

  const requestOriginCandidates = readRequestOriginCandidates(params.request);

  for (const requestOrigin of requestOriginCandidates) {
    const normalizedRequestOrigin = normalizeAllowedRuntimeOrigin(
      requestOrigin,
      allowedOrigins
    );
    const resolvedRequestOrigin = resolveAllowedRuntimeOrigin(
      normalizedRequestOrigin,
      allowedOrigins,
      allowLocalOrigin,
      params.request,
      requestOriginCandidates
    );
    if (!resolvedRequestOrigin) {
      continue;
    }
    if (
      params.preferRequestOrigin ||
      isLocalAuthRuntimeOrigin(resolvedRequestOrigin)
    ) {
      return resolvedRequestOrigin;
    }
  }

  return canonicalOrigin;
}
