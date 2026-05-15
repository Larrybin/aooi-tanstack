import { getRuntimeEnvString } from '@/infra/runtime/env.server';

import {
  AUTH_RUNTIME_DIAGNOSTICS_PATH,
  AUTH_RUNTIME_DIAGNOSTICS_SECRET_HEADER,
  type AuthHandlerWorkerBindingsSnapshot,
  type AuthUiWorkerBindingsSnapshot,
  type AuthWorkerBindingsSnapshot,
} from '@/shared/config/auth-runtime-diagnostics';

function readEnvFlag(name: string) {
  return (getRuntimeEnvString(name)?.trim() || '').length > 0;
}

function getSharedAuthSecret() {
  return (
    getRuntimeEnvString('BETTER_AUTH_SECRET')?.trim() ||
    getRuntimeEnvString('AUTH_SECRET')?.trim() ||
    ''
  );
}

function isAuthorizedDiagnosticsRequest(request: Request) {
  const expected = getSharedAuthSecret();
  if (!expected) {
    return false;
  }

  return (
    request.headers.get(AUTH_RUNTIME_DIAGNOSTICS_SECRET_HEADER)?.trim() ===
    expected
  );
}

function buildAuthUiWorkerBindingsSnapshot(
  workerTarget: string
): AuthUiWorkerBindingsSnapshot {
  return {
    role: 'auth-ui',
    workerTarget,
    googleClientIdPresent: readEnvFlag('GOOGLE_CLIENT_ID'),
  };
}

function buildAuthHandlerWorkerBindingsSnapshot(
  workerTarget: string
): AuthHandlerWorkerBindingsSnapshot {
  return {
    role: 'auth-handler',
    workerTarget,
    googleClientIdPresent: readEnvFlag('GOOGLE_CLIENT_ID'),
    googleClientSecretPresent: readEnvFlag('GOOGLE_CLIENT_SECRET'),
    githubClientIdPresent: readEnvFlag('GITHUB_CLIENT_ID'),
    githubClientSecretPresent: readEnvFlag('GITHUB_CLIENT_SECRET'),
  };
}

export function maybeHandleAuthRuntimeDiagnosticsRequest({
  request,
  workerTarget,
  role,
}: {
  request: Request;
  workerTarget: string;
  role: 'auth-ui' | 'auth-handler';
}) {
  const url = new URL(request.url);
  if (url.pathname !== AUTH_RUNTIME_DIAGNOSTICS_PATH) {
    return null;
  }

  if (!isAuthorizedDiagnosticsRequest(request)) {
    return new Response('forbidden', { status: 403 });
  }

  const body: AuthWorkerBindingsSnapshot =
    role === 'auth-ui'
      ? buildAuthUiWorkerBindingsSnapshot(workerTarget)
      : buildAuthHandlerWorkerBindingsSnapshot(workerTarget);

  return Response.json(body);
}
