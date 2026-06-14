import {
  runWithCloudflareBindings,
  type CloudflareBindings,
} from '@/infra/runtime/env.server';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readBindingsFromWorkersModule(
  workers: unknown
): CloudflareBindings | null {
  if (!isObject(workers)) {
    return null;
  }

  if (isObject(workers.env)) {
    return workers.env;
  }

  if (isObject(workers.default) && isObject(workers.default.env)) {
    return workers.default.env;
  }

  return null;
}

export async function readTanStackCloudflareBindings(): Promise<CloudflareBindings | null> {
  try {
    return readBindingsFromWorkersModule(await import('cloudflare:workers'));
  } catch {
    return null;
  }
}

export async function runWithTanStackCloudflareBindings<T>(
  callback: () => Promise<T> | T
): Promise<T> {
  const bindings = await readTanStackCloudflareBindings();
  return await runWithCloudflareBindings(bindings, callback);
}

export function withTanStackCloudflareBindings<
  TArgs extends unknown[],
  TResult,
>(handler: (...args: TArgs) => Promise<TResult> | TResult) {
  return (...args: TArgs): Promise<TResult> =>
    runWithTanStackCloudflareBindings(() => handler(...args));
}
