import {
  normalizeAuthSpikeRedirectLocationValue,
  resolveAuthSpikeRedirectRequestUrl,
  toRelativeSameOriginAuthSpikeRedirectLocationValue,
} from '@/infra/platform/auth/auth-spike-redirect';
import { isAuthSpikeOAuthUpstreamMockEnabled } from '@/infra/platform/auth/oauth-spike-config';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import { setResponseHeader } from '@/shared/lib/api/response-headers';

type AuthApiHandler = {
  handler(request: Request): Promise<Response>;
};

type AuthOriginDebug = {
  runtimeBaseUrl: string;
};

type AuthApiActionDeps = {
  getAuth?: (request: Request) => Promise<AuthApiHandler>;
  isAuthSpikeOAuthUpstreamMockEnabled?: () => boolean;
  getAuthOriginDebug?: (
    request: Request
  ) => AuthOriginDebug | Promise<AuthOriginDebug>;
  getRuntimeEnvString?: typeof getRuntimeEnvString;
};

export async function handleAuthApiRequest(
  request: Request,
  deps: AuthApiActionDeps = {}
): Promise<Response> {
  const auth = await (deps.getAuth ?? getDefaultAuth)(request);
  const response = await normalizeAuthSpikeRedirectLocation(
    await auth.handler(toStandardAuthRequest(request)),
    request,
    deps
  );

  return withNoStore(response);
}

async function getDefaultAuth(request: Request): Promise<AuthApiHandler> {
  const { getAuth } = await import('@/infra/platform/auth');
  return getAuth(request);
}

async function getDefaultAuthOriginDebug(
  request: Request
): Promise<AuthOriginDebug> {
  const { getAuthOriginDebug } = await import('@/infra/platform/auth/config');
  return getAuthOriginDebug(request);
}

function withNoStore(response: Response): Response {
  return setResponseHeader(response, 'Cache-Control', 'no-store');
}

function normalizeAuthSpikeRedirectLocation(
  response: Response,
  request: Request,
  deps: AuthApiActionDeps
): Promise<Response> | Response {
  const isAuthSpikeOAuthUpstreamMock =
    deps.isAuthSpikeOAuthUpstreamMockEnabled ??
    isAuthSpikeOAuthUpstreamMockEnabled;
  if (!isAuthSpikeOAuthUpstreamMock()) {
    return response;
  }

  const location = response.headers.get('location')?.trim();
  if (!location) {
    return response;
  }

  return normalizeAuthSpikeRedirectLocationWithOrigin(
    response,
    request,
    location,
    deps
  );
}

async function normalizeAuthSpikeRedirectLocationWithOrigin(
  response: Response,
  request: Request,
  location: string,
  deps: AuthApiActionDeps
): Promise<Response> {
  const { runtimeBaseUrl } = await (
    deps.getAuthOriginDebug ?? getDefaultAuthOriginDebug
  )(request);
  const requestUrlForNormalization = resolveAuthSpikeRedirectRequestUrl(
    request,
    {
      runtimeBaseUrl,
    }
  );
  const normalizedLocation = normalizeAuthSpikeRedirectLocationValue(
    location,
    requestUrlForNormalization
  );
  const rewrittenLocation =
    normalizedLocation &&
    toRelativeSameOriginAuthSpikeRedirectLocationValue(
      normalizedLocation,
      requestUrlForNormalization
    );
  const readRuntimeEnv = deps.getRuntimeEnvString ?? getRuntimeEnvString;
  if (readRuntimeEnv('CF_LOCAL_AUTH_DEBUG') === 'true') {
    process.stderr.write(
      `[auth-redirect-debug] ${JSON.stringify({
        requestUrl: request.url,
        requestUrlForNormalization,
        runtimeBaseUrl,
        rawLocation: location,
        normalizedLocation,
        rewrittenLocation,
      })}\n`
    );
  }
  const finalLocation = rewrittenLocation || normalizedLocation;
  if (!finalLocation || finalLocation === location) {
    return response;
  }

  return setResponseHeader(response, 'Location', finalLocation);
}

function toStandardAuthRequest(request: Request): Request {
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: new Headers(request.headers),
  };

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }

  return new Request(request.url, init);
}
