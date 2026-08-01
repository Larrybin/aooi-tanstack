import { getOrCreateRequestId } from '../../src/infra/platform/logging/request-id.server';
import { createServerWorker } from './create-server-worker';
import {
  applyNativeRouterMiddleware,
  buildNativeForwardingRequest,
  withRouterResponseHeaders,
} from './router-middleware';

type FetcherBinding = {
  fetch(request: Request): Promise<Response>;
};

type AppEnv = Record<string, unknown> & {
  ASSETS?: FetcherBinding;
  NEXT_PUBLIC_APP_URL?: string;
  REMOVER_CLEANUP_SECRET?: string;
};

type ServerModule = Parameters<
  typeof createServerWorker<AppEnv>
>[0] extends () => Promise<infer Module>
  ? Module
  : never;

function isStaticAssetRequest(url: URL) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/imgs/') ||
    url.pathname.startsWith('/vendor/') ||
    /\.[a-z0-9][a-z0-9-]*$/i.test(url.pathname)
  );
}

function getStringBinding(env: AppEnv, key: keyof AppEnv) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function createAppWorker(loadServerModule: () => Promise<ServerModule>) {
  const serverWorker = createServerWorker<AppEnv>(loadServerModule);
  const appWorker = {
    async fetch(request: Request, env: AppEnv, ctx: ExecutionContext) {
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

      const appRequest = buildNativeForwardingRequest(
        middlewareResult,
        requestId,
        request
      );
      const response = await serverWorker.fetch(appRequest, env, ctx);
      return withRouterResponseHeaders(response, request, requestId);
    },

    async scheduled(_controller: unknown, env: AppEnv, ctx: ExecutionContext) {
      const cleanupSecret = getStringBinding(env, 'REMOVER_CLEANUP_SECRET');
      if (!cleanupSecret) return;

      const appUrl = getStringBinding(env, 'NEXT_PUBLIC_APP_URL');
      if (!appUrl) {
        throw new Error(
          '[remover-cleanup] NEXT_PUBLIC_APP_URL is not configured'
        );
      }

      const response = await appWorker.fetch(
        new Request(new URL('/api/remover/cleanup', appUrl), {
          method: 'POST',
          headers: { Authorization: `Bearer ${cleanupSecret}` },
        }),
        env,
        ctx
      );
      if (!response.ok) {
        throw new Error(
          `[remover-cleanup] scheduled cleanup failed with status ${response.status}`
        );
      }
    },
  };

  return appWorker;
}
