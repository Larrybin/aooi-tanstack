import { NextResponse, type NextRequest } from 'next/server';
import { getOrCreateRequestId } from '@/infra/platform/logging/request-id.server';
import { proxy } from '@/request-proxy';

import { upsertMiddlewareRequestHeader } from '@/shared/lib/middleware-request-headers';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://scripts.simpleanalyticscdn.com https://plausible.io https://openpanel.dev https://embed.tawk.to https://client.crisp.chat https://*.adsterra.com https://*.highperformanceformat.com https://*.highcpmrevenuenetwork.com",
  "script-src-elem 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://www.clarity.ms https://scripts.simpleanalyticscdn.com https://plausible.io https://openpanel.dev https://embed.tawk.to https://client.crisp.chat https://*.adsterra.com https://*.highperformanceformat.com https://*.highcpmrevenuenetwork.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://client.crisp.chat",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com https://client.crisp.chat",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.clarity.ms https://*.clarity.ms https://plausible.io https://openpanel.dev https://client.crisp.chat wss://client.relay.crisp.chat https://embed.tawk.to wss://*.tawk.to",
  "frame-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com https://vars.hotjar.com https://embed.tawk.to https://client.crisp.chat",
  "form-action 'self'",
].join('; ');

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  return response;
}

export async function middleware(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers);

  // Keep /api logic minimal: only inject requestId.
  if (request.nextUrl.pathname.startsWith('/api')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);
    requestHeaders.set('x-pathname', request.nextUrl.pathname);
    requestHeaders.set('x-url', request.url);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set('x-request-id', requestId);
    return applySecurityHeaders(response);
  }

  // Non-API requests: reuse existing proxy (i18n + auth gating) and add requestId.
  const proxied = await proxy(request);
  proxied.headers.set('x-request-id', requestId);
  upsertMiddlewareRequestHeader(proxied.headers, 'x-request-id', requestId);
  return applySecurityHeaders(proxied);
}

export const config = {
  // Includes `/api/**`; API handling is branched inside `middleware()`.
  matcher: ['/((?!_next|.*\\..*).*)'],
};
