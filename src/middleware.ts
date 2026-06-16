import { NextResponse, type NextRequest } from 'next/server';
import { getOrCreateRequestId } from '@/infra/platform/logging/request-id.server';
import { proxy } from '@/request-proxy';

import { upsertMiddlewareRequestHeader } from '@/shared/lib/middleware-request-headers';
import { applySecurityHeadersToHeaders } from '@/shared/security/response-headers';

function applySecurityHeaders(response: NextResponse): NextResponse {
  applySecurityHeadersToHeaders(response.headers);
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
