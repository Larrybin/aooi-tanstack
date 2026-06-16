import { defaultLocale, locales, type Locale } from '../../src/config/locale';
import { localeCodes } from '../../src/config/locale/registry';
import { readSessionTokenFromCookieHeader } from '../../src/infra/platform/auth/session-cookie';
import { ADMIN_PATH } from '../../src/shared/constants/admin-entry';
import { applySecurityHeadersToHeaders } from '../../src/shared/security/response-headers';

const registeredLocaleSet: ReadonlySet<string> = new Set(localeCodes);

export function withRouterResponseHeaders(
  response: Response,
  request: Request,
  requestId: string
) {
  const url = new URL(request.url);
  const nextResponse = new Response(response.body, response);
  nextResponse.headers.set('x-request-id', requestId);
  nextResponse.headers.set('x-pathname', url.pathname);
  nextResponse.headers.set('x-url', request.url);
  applySecurityHeadersToHeaders(nextResponse.headers);
  return nextResponse;
}

export function buildNativeForwardingRequest(
  request: Request,
  requestId: string,
  headerSource: Request = request
) {
  const url = new URL(headerSource.url);
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  headers.set('x-pathname', url.pathname);
  headers.set('x-url', headerSource.url);
  return new Request(request, { headers });
}

export function applyNativeRouterMiddleware(
  request: Request
): Request | Response {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const localeSegment = pathname.split('/')[1] || '';
  const isValidLocale = locales.includes(localeSegment as Locale);
  const isRegisteredLocale = registeredLocaleSet.has(localeSegment);

  if (isRegisteredLocale && !isValidLocale) {
    return new Response('Not found', { status: 404 });
  }

  const pathWithoutLocale = isValidLocale
    ? pathname.slice(localeSegment.length + 1) || '/'
    : pathname;

  if (isProtectedPath(pathWithoutLocale) && !hasSessionCookie(request)) {
    const signInUrl = new URL(
      isValidLocale ? `/${localeSegment}/sign-in` : '/sign-in',
      request.url
    );
    signInUrl.searchParams.set(
      'callbackUrl',
      `${pathWithoutLocale}${url.search}`
    );
    return Response.redirect(signInUrl, 307);
  }

  if (pathWithoutLocale === '/docs' || pathWithoutLocale === '/docs/') {
    const rewriteUrl = new URL(request.url);
    rewriteUrl.pathname = isValidLocale
      ? `/${localeSegment}/docs/index`
      : `/${defaultLocale}/docs/index`;
    return new Request(rewriteUrl, request);
  }

  return request;
}

function isProtectedPath(pathname: string) {
  return (
    pathname === ADMIN_PATH ||
    pathname.startsWith(`${ADMIN_PATH}/`) ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/activity')
  );
}

function hasSessionCookie(request: Request) {
  return (
    readSessionTokenFromCookieHeader(request.headers.get('cookie')) !== null
  );
}
