import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { readSiteI18nPackage } from './lib/site-i18n-pages.mjs';

const rootDir = process.cwd();

function parseSiteArg(args) {
  const siteEqualsArg = args.find((arg) => arg.startsWith('--site='));
  if (siteEqualsArg) {
    return siteEqualsArg.slice('--site='.length).trim();
  }

  const siteArgIndex = args.indexOf('--site');
  if (siteArgIndex >= 0) {
    return args[siteArgIndex + 1]?.trim() || '';
  }

  return '';
}

function listSiteKeys() {
  const sitesDir = path.resolve(rootDir, 'sites');
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((siteKey) =>
      existsSync(path.resolve(sitesDir, siteKey, 'site.config.json'))
    )
    .sort();
}

function checkSite(siteKey) {
  const { pages, manifest } = readSiteI18nPackage({ rootDir, siteKey });
  console.log(
    `[i18n:schema] ${siteKey}: ${pages.pages.length} pages, ${
      Object.keys(manifest.locales).length
    } manifest locales`
  );
}

const selectedSiteKey = parseSiteArg(process.argv.slice(2));
const siteKeys = selectedSiteKey ? [selectedSiteKey] : listSiteKeys();

try {
  for (const siteKey of siteKeys) {
    checkSite(siteKey);
  }
} catch (error) {
  console.error(
    `[i18n:schema] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
