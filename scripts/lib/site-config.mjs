import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { validateSiteConfig } from '../site-schema.mjs';

export const TEST_SITE_KEY = 'dev-local';

export function resolveRequiredSiteKey(env = process.env) {
  const siteKey = env.SITE?.trim();
  if (!siteKey) {
    throw new Error(
      'SITE is required. Use an explicit site key such as SITE=mamamiya or SITE=dev-local.'
    );
  }

  return siteKey;
}

export function resolveSiteConfigPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'site.config.json');
}

export function listConfiguredSiteKeys(rootDir = process.cwd()) {
  const sitesDir = path.resolve(rootDir, 'sites');
  if (!existsSync(sitesDir)) {
    return [];
  }

  return readdirSync(sitesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((siteKey) =>
      existsSync(path.resolve(sitesDir, siteKey, 'site.config.json'))
    )
    .sort();
}

function formatConfiguredSiteKeys(siteKeys) {
  return siteKeys.length > 0 ? siteKeys.join(', ') : '<none>';
}

export function readCurrentSiteConfig({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const sourcePath = resolveSiteConfigPath({ rootDir, siteKey });
  if (!existsSync(sourcePath)) {
    throw new Error(
      `site "${siteKey}" is not configured: missing sites/${siteKey}/site.config.json. Create sites/${siteKey}/site.config.json or set SITE to one of: ${formatConfiguredSiteKeys(listConfiguredSiteKeys(rootDir))}.`
    );
  }

  const raw = readFileSync(sourcePath, 'utf8');
  const site = JSON.parse(raw);

  validateSiteConfig(site);
  if (site.key !== siteKey) {
    throw new Error(
      `site config key mismatch: expected "${siteKey}" but found "${site.key}" in sites/${siteKey}/site.config.json`
    );
  }
  return site;
}
