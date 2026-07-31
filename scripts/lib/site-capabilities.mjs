export function hasSiteModule(site, moduleId) {
  return site.capabilities.enabledModules.includes(moduleId);
}
