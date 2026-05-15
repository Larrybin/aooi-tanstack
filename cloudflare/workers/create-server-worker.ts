import { isRuntimeEnvEnabled } from '../../src/infra/runtime/env.server';

type CloudflareFetchHandler<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  signal?: AbortSignal
) => Promise<Response> | Response;

type CloudflareFetchModule<Env> = {
  handler: CloudflareFetchHandler<Env>;
};

type BeforeFetchHook<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response | null> | Response | null;

type RuntimeEnvOptions = Parameters<typeof isRuntimeEnvEnabled>[1];

type RunWithCloudflareRequestContext = <Env>(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  callback: () => Promise<Response> | Response
) => Promise<Response> | Response;

let runWithCloudflareRequestContextPromise:
  | Promise<RunWithCloudflareRequestContext>
  | undefined;

function loadRunWithCloudflareRequestContext() {
  return (runWithCloudflareRequestContextPromise ??=
    import('../../.open-next/cloudflare/init.js').then(
      (module) =>
        module.runWithCloudflareRequestContext as RunWithCloudflareRequestContext
    ));
}

export function syncWorkerStringBindingsToProcessEnv(env: unknown) {
  if (!env || typeof env !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }

    process.env[key] = value;
  }
}

export function shouldPrintServerWorkerAuthDebug(
  request: Request,
  options: RuntimeEnvOptions = {}
) {
  if (!isRuntimeEnvEnabled('CF_LOCAL_AUTH_DEBUG', options)) {
    return false;
  }

  const url = new URL(request.url);
  return url.pathname.startsWith('/api/auth/');
}

function printServerWorkerAuthDebug(request: Request) {
  if (!shouldPrintServerWorkerAuthDebug(request)) {
    return;
  }

  console.error('[server-worker-auth-debug] incoming request', {
    requestUrl: request.url,
    requestOrigin: request.headers.get('origin'),
    requestHost: request.headers.get('host'),
    requestForwardedHost: request.headers.get('x-forwarded-host'),
    requestForwardedProto: request.headers.get('x-forwarded-proto'),
    requestReferer: request.headers.get('referer'),
  });
}

export function createServerWorker<Env>(
  loadModule: () => Promise<CloudflareFetchModule<Env>>,
  options: {
    beforeFetch?: BeforeFetchHook<Env>;
  } = {}
) {
  let handlerPromise: Promise<CloudflareFetchHandler<Env>> | undefined;

  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
      syncWorkerStringBindingsToProcessEnv(env);
      const handler = (handlerPromise ??= loadModule().then(
        ({ handler }) => handler
      ));
      const runWithCloudflareRequestContext =
        await loadRunWithCloudflareRequestContext();

      return runWithCloudflareRequestContext(request, env, ctx, async () => {
        const beforeFetchResponse = await options.beforeFetch?.(
          request,
          env,
          ctx
        );
        if (beforeFetchResponse) {
          return beforeFetchResponse;
        }

        printServerWorkerAuthDebug(request);
        return (await handler)(request, env, ctx, request.signal);
      });
    },
  };
}
