
import { unstable_cache as nextUnstableCache } from 'next/cache';

type CacheCallback = (...args: unknown[]) => Promise<unknown>;

export function unstable_cache<T extends CacheCallback>(
  callback: T,
  keyParts?: string[],
  options?: Parameters<typeof nextUnstableCache>[2]
) {
  return nextUnstableCache(callback, keyParts, options) as T;
}
