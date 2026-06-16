import { getRuntimeSettingsCacheVersion } from './settings-cache-version';

type AsyncReader<T> = () => Promise<T>;

export function cacheSettingsReader<T>(
  reader: AsyncReader<T>,
  options: { revalidateSeconds: number }
): AsyncReader<T> {
  let cachedValue: T | undefined;
  let cachedVersion = -1;
  let expiresAt = 0;

  return async () => {
    const currentVersion = getRuntimeSettingsCacheVersion();
    const now = Date.now();
    if (
      cachedValue !== undefined &&
      cachedVersion === currentVersion &&
      now < expiresAt
    ) {
      return cachedValue;
    }

    const nextValue = await reader();
    cachedValue = nextValue;
    cachedVersion = currentVersion;
    expiresAt = now + options.revalidateSeconds * 1000;
    return nextValue;
  };
}

export function revalidateSettingsCacheTag(_tag: string) {
  // Native TanStack runtime uses settings-cache-version for invalidation.
}
