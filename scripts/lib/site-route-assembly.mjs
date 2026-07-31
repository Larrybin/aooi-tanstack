import { readdirSync } from 'node:fs';
import path from 'node:path';

import { SITE_MODULE_IDS } from '../../src/config/product-modules/registry.mjs';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSiteRouteIgnorePattern({ rootDir = process.cwd(), site }) {
  const enabledModules = new Set(site.capabilities.enabledModules);
  const disabledGroups = SITE_MODULE_IDS.filter(
    (moduleId) => !enabledModules.has(moduleId)
  ).map((moduleId) => `(module_${moduleId})`);

  const siteGroups = readdirSync(path.resolve(rootDir, 'sites'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && entry.name !== site.key)
    .map((entry) => `(site_${entry.name})`);

  return `^(?:${[...disabledGroups, ...siteGroups]
    .map(escapeRegExp)
    .join('|')})$`;
}
