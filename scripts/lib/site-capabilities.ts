export function hasSiteModule(
  site: { capabilities: { enabledModules: readonly string[] } },
  moduleId: string
) {
  return site.capabilities.enabledModules.includes(moduleId);
}
