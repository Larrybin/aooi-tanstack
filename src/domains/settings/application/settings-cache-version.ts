let runtimeSettingsCacheVersion = 0;

export function getRuntimeSettingsCacheVersion() {
  return runtimeSettingsCacheVersion;
}

export function invalidateRuntimeSettingsCacheVersion() {
  runtimeSettingsCacheVersion += 1;
  return runtimeSettingsCacheVersion;
}
