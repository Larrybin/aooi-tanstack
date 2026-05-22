import {
  buildVersionOverridesHeader,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  type CloudflareServerWorkerTarget,
} from '../../src/shared/config/cloudflare-worker-splits';

type WorkerServiceBinding = {
  fetch(
    request: Request,
    init?: RequestInit & { cf?: Record<string, unknown> }
  ): Promise<Response>;
};

type RouterEnv = Record<string, string | WorkerServiceBinding>;

function normalizeForwardedUrl(
  originalRequest: Request,
  middlewareRequest: Request,
  env: RouterEnv,
  workerTarget: CloudflareServerWorkerTarget
): string {
  const originalUrl = new URL(originalRequest.url);
  const middlewareUrl = new URL(middlewareRequest.url);
  const forwardedUrl = new URL(middlewareUrl.toString());
  const localWorkerUrl = env[CLOUDFLARE_LOCAL_WORKER_URL_VARS[workerTarget]];

  if (typeof localWorkerUrl === 'string' && localWorkerUrl.trim()) {
    const targetUrl = new URL(localWorkerUrl);
    forwardedUrl.protocol = targetUrl.protocol;
    forwardedUrl.host = targetUrl.host;
  } else {
    forwardedUrl.protocol = originalUrl.protocol;
    forwardedUrl.host = originalUrl.host;
  }

  return forwardedUrl.toString();
}

function buildForwardedHeaders(
  originalRequest: Request,
  middlewareRequest: Request,
  env: RouterEnv,
  activeTargets?: readonly CloudflareServerWorkerTarget[]
): Headers {
  const headers = new Headers(middlewareRequest.headers);
  const originalUrl = new URL(originalRequest.url);
  const originalOrigin =
    originalRequest.headers.get('origin') || originalUrl.origin;
  const forwardedHost =
    originalRequest.headers.get('x-forwarded-host') ||
    originalRequest.headers.get('host') ||
    originalUrl.host;
  const forwardedProto =
    originalRequest.headers.get('x-forwarded-proto') ||
    originalUrl.protocol.replace(/:$/, '');

  headers.set('origin', originalOrigin);
  headers.set('x-forwarded-host', forwardedHost);
  headers.set('x-forwarded-proto', forwardedProto);

  const versionOverrides = buildVersionOverridesHeader(
    Object.fromEntries(
      Object.entries(env).filter(
        ([, value]) => typeof value === 'string'
      ) as Array<[string, string]>
    ),
    activeTargets
  );
  if (versionOverrides) {
    headers.set('Cloudflare-Workers-Version-Overrides', versionOverrides);
  }

  return headers;
}

export function buildForwardedWorkerRequest(
  originalRequest: Request,
  middlewareRequest: Request,
  env: RouterEnv,
  workerTarget: CloudflareServerWorkerTarget,
  activeTargets?: readonly CloudflareServerWorkerTarget[]
): Request {
  const forwardedUrl = normalizeForwardedUrl(
    originalRequest,
    middlewareRequest,
    env,
    workerTarget
  );
  const normalizedRequest = new Request(forwardedUrl, middlewareRequest);
  const headers = buildForwardedHeaders(
    originalRequest,
    middlewareRequest,
    env,
    activeTargets
  );

  return new Request(normalizedRequest, { headers });
}
