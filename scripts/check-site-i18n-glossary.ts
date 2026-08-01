import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  readGlobalI18nGlossary,
  readMergedI18nGlossary,
  readSiteI18nGlossary,
} from './lib/site-i18n-glossary.ts';

const rootDir = process.cwd();

function parseSiteArg(args: string[]) {
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

function checkSite(siteKey: string) {
  const siteGlossary = readSiteI18nGlossary({ rootDir, siteKey });
  const mergedGlossary = readMergedI18nGlossary({ rootDir, siteKey });

  console.log(
    `[i18n:glossary] ${siteKey}: ${mergedGlossary.preserve.length} preserved terms, ${
      Object.keys(siteGlossary.terms).length
    } term rules`
  );
}

const selectedSiteKey = parseSiteArg(process.argv.slice(2));
const siteKeys = selectedSiteKey ? [selectedSiteKey] : listSiteKeys();

try {
  readGlobalI18nGlossary({ rootDir });
  for (const siteKey of siteKeys) {
    checkSite(siteKey);
  }
} catch (error) {
  console.error(
    `[i18n:glossary] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
