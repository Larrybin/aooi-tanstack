export const AUTH_RUNTIME_DIAGNOSTICS_PATH =
  '/__internal/auth-runtime-diagnostics';
export const AUTH_RUNTIME_DIAGNOSTICS_SECRET_HEADER =
  'x-auth-runtime-diagnostics-secret';

export type AuthUiWorkerBindingsSnapshot = {
  role: 'auth-ui';
  workerTarget: string;
  googleClientIdPresent: boolean;
};

export type AuthHandlerWorkerBindingsSnapshot = {
  role: 'auth-handler';
  workerTarget: string;
  googleClientIdPresent: boolean;
  googleClientSecretPresent: boolean;
  githubClientIdPresent: boolean;
  githubClientSecretPresent: boolean;
};

export type AuthWorkerBindingsSnapshot =
  | AuthUiWorkerBindingsSnapshot
  | AuthHandlerWorkerBindingsSnapshot;
