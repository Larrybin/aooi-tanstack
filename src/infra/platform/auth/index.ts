
import { betterAuth } from 'better-auth';

import { getAuthOptions, type AuthConfigDeps } from './config';

type AuthInstance = Awaited<ReturnType<typeof betterAuth>>;

const authByRequest = new WeakMap<Request, Promise<AuthInstance>>();

async function createAuthInstance(
  request?: Request,
  deps?: AuthConfigDeps
): Promise<AuthInstance> {
  return betterAuth(await getAuthOptions(request, deps));
}

async function getAuthPromiseForRequest(
  request?: Request,
  deps?: AuthConfigDeps
): Promise<AuthInstance> {
  if (deps) {
    return createAuthInstance(request, deps);
  }

  if (!request) {
    return createAuthInstance();
  }

  const cached = authByRequest.get(request);
  if (cached) {
    return cached;
  }

  const promise = createAuthInstance(request).catch((error) => {
    authByRequest.delete(request);
    throw error;
  });
  authByRequest.set(request, promise);
  return promise;
}

export async function getAuth(
  request?: Request,
  deps?: AuthConfigDeps
): Promise<AuthInstance> {
  return getAuthPromiseForRequest(request, deps);
}
