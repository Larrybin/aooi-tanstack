import {
  isRuntimeEnvEnabled,
  type CloudflareBindings,
} from '../../src/infra/runtime/env.server';

type CloudflareFetchHandler<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  signal?: AbortSignal
) => Promise<Response> | Response;

type CloudflareFetchModule<Env> = {
  handler?: CloudflareFetchHandler<Env>;
  default?: {
    fetch(request: Request): Promise<Response> | Response;
  };
};

type BeforeFetchHook<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response | null> | Response | null;

type RuntimeEnvOptions = Parameters<typeof isRuntimeEnvEnabled>[1];

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

function printServerWorkerAuthDebug(request: Request, env: unknown) {
  if (
    !shouldPrintServerWorkerAuthDebug(request, {
      bindings: env as CloudflareBindings,
    })
  ) {
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

function resolveModuleHandler<Env>(module: CloudflareFetchModule<Env>) {
  if (module.handler) {
    return module.handler;
  }

  if (module.default?.fetch) {
    return (request: Request) => module.default!.fetch(request);
  }

  throw new Error('Cloudflare server worker module has no handler or default.fetch');
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
      const handler = (handlerPromise ??= loadModule().then(resolveModuleHandler));

      const beforeFetchResponse = await options.beforeFetch?.(
        request,
        env,
        ctx
      );
      if (beforeFetchResponse) {
        return beforeFetchResponse;
      }

      printServerWorkerAuthDebug(request, env);
      return (await handler)(request, env, ctx, request.signal);
    },
  };
}
