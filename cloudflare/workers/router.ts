import { getOrCreateRequestId } from '../../src/infra/platform/logging/request-id.server';
import {
  CLOUDFLARE_SERVICE_BINDINGS,
  getDeclaredServerWorkerTargets,
  resolveWorkerRoutingDecision,
} from '../../src/shared/config/cloudflare-worker-splits';
import { buildForwardedWorkerRequest } from './router-forwarding';

type WorkerServiceBinding = {
  fetch(
    request: Request,
    init?: RequestInit & { cf?: Record<string, unknown> }
  ): Promise<Response>;
};

type RouterEnv = Record<string, string | WorkerServiceBinding> & {
  ASSETS?: WorkerServiceBinding;
  PUBLIC_WEB_WORKER: WorkerServiceBinding;
  AUTH_WORKER?: WorkerServiceBinding;
  PAYMENT_WORKER?: WorkerServiceBinding;
  ADMIN_WORKER?: WorkerServiceBinding;
  MEMBER_WORKER?: WorkerServiceBinding;
  CHAT_WORKER?: WorkerServiceBinding;
};

function withRequestId(response: Response, requestId: string) {
  const nextResponse = new Response(response.body, response);
  nextResponse.headers.set('x-request-id', requestId);
  return nextResponse;
}

function buildNativeForwardingRequest(request: Request, requestId: string) {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  headers.set('x-pathname', url.pathname);
  headers.set('x-url', request.url);
  return new Request(request, { headers });
}

function isStaticAssetRequest(url: URL) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/imgs/') ||
    url.pathname.startsWith('/vendor/') ||
    /\.[a-z0-9][a-z0-9-]*$/i.test(url.pathname)
  );
}

const routerWorker = {
  async fetch(request: Request, env: RouterEnv) {
    const requestId = getOrCreateRequestId(request.headers);
    const url = new URL(request.url);

    if (isStaticAssetRequest(url) && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return withRequestId(assetResponse, requestId);
      }
    }

    const forwardingRequest = buildNativeForwardingRequest(request, requestId);
    const declaredWorkerTargets = getDeclaredServerWorkerTargets(env);
    const routingDecision = resolveWorkerRoutingDecision(
      url.pathname,
      declaredWorkerTargets
    );
    if (routingDecision.kind === 'disabled-api') {
      return withRequestId(new Response('Not found', { status: 404 }), requestId);
    }

    const workerTarget = routingDecision.target;
    const serviceBindingName = CLOUDFLARE_SERVICE_BINDINGS[workerTarget];
    const serviceBinding = env[serviceBindingName];
    if (!serviceBinding || typeof serviceBinding === 'string') {
      throw new Error(
        `Missing Cloudflare service binding for ${workerTarget} (${serviceBindingName})`
      );
    }

    const forwardedRequest = buildForwardedWorkerRequest(
      request,
      forwardingRequest,
      env,
      workerTarget,
      declaredWorkerTargets
    );
    const response = await serviceBinding.fetch(forwardedRequest, {
      redirect: 'manual',
      cf: {
        cacheEverything: false,
      },
    });
    return withRequestId(response, requestId);
  },
};

export default routerWorker;
