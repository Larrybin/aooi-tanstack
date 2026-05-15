import { maybeHandleAuthRuntimeDiagnosticsRequest } from './auth-runtime-diagnostics';
import { createServerWorker } from './create-server-worker';

type PublicWebEnv = Record<string, unknown> & {
  NEXT_PUBLIC_APP_URL?: string;
  REMOVER_CLEANUP_SECRET?: string;
};

const publicWebWorker = createServerWorker<PublicWebEnv>(
  () =>
    import('../../.open-next/server-functions/default/handler.mjs') as Promise<{
      handler: (
        request: Request,
        env: PublicWebEnv,
        ctx: ExecutionContext,
        signal?: AbortSignal
      ) => Promise<Response> | Response;
    }>,
  {
    beforeFetch(request) {
      return maybeHandleAuthRuntimeDiagnosticsRequest({
        request,
        workerTarget: 'public-web',
        role: 'auth-ui',
      });
    },
  }
);

function getStringBinding(env: PublicWebEnv, key: keyof PublicWebEnv) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

const serverPublicWebWorker = {
  fetch: publicWebWorker.fetch,
  async scheduled(
    _controller: unknown,
    env: PublicWebEnv,
    ctx: ExecutionContext
  ) {
    const cleanupSecret = getStringBinding(env, 'REMOVER_CLEANUP_SECRET');
    if (!cleanupSecret) {
      throw new Error(
        '[remover-cleanup] REMOVER_CLEANUP_SECRET is not configured'
      );
    }

    const appUrl = getStringBinding(env, 'NEXT_PUBLIC_APP_URL');
    if (!appUrl) {
      throw new Error(
        '[remover-cleanup] NEXT_PUBLIC_APP_URL is not configured'
      );
    }

    const cleanupUrl = new URL('/api/remover/cleanup', appUrl);
    const response = await publicWebWorker.fetch(
      new Request(cleanupUrl.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanupSecret}`,
        },
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

export default serverPublicWebWorker;
