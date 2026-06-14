import {
  runWithCloudflareBindings,
  type CloudflareBindings,
} from '@/infra/runtime/env.server';

export async function readTanStackCloudflareBindings(): Promise<CloudflareBindings | null> {
  try {
    const workers = (await import('cloudflare:workers')) as unknown as {
      env?: CloudflareBindings;
      default?: { env?: CloudflareBindings };
    };
    return workers.env ?? workers.default?.env ?? null;
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
