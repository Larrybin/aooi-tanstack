import { readdirSync } from 'node:fs';
import path from 'node:path';

import { SITE_MODULE_IDS } from '../../src/config/product-modules/registry.ts';
import type { SiteConfig } from '../site-schema.ts';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSiteRouteIgnorePattern({
  rootDir = process.cwd(),
  site,
}: {
  rootDir?: string;
  site: SiteConfig;
}): string {
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
