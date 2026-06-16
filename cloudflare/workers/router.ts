import { getOrCreateRequestId } from '../../src/infra/platform/logging/request-id.server';
import {
  CLOUDFLARE_SERVICE_BINDINGS,
  getDeclaredServerWorkerTargets,
  resolveWorkerRoutingDecision,
} from '../../src/shared/config/cloudflare-worker-splits';
import { buildForwardedWorkerRequest } from './router-forwarding';
import {
  applyNativeRouterMiddleware,
  buildNativeForwardingRequest,
  withRouterResponseHeaders,
} from './router-middleware';

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
        return withRouterResponseHeaders(assetResponse, request, requestId);
      }
    }

    const middlewareResult = applyNativeRouterMiddleware(request);
    if (middlewareResult instanceof Response) {
      return withRouterResponseHeaders(middlewareResult, request, requestId);
    }

    const forwardingRequest = buildNativeForwardingRequest(
      middlewareResult,
      requestId,
      request
    );
    const declaredWorkerTargets = getDeclaredServerWorkerTargets(env);
    const routingDecision = resolveWorkerRoutingDecision(
      new URL(forwardingRequest.url).pathname,
      declaredWorkerTargets
    );
    if (routingDecision.kind === 'disabled-api') {
      return withRouterResponseHeaders(
        new Response('Not found', { status: 404 }),
        request,
        requestId
      );
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
    return withRouterResponseHeaders(response, request, requestId);
  },
};

export default routerWorker;
