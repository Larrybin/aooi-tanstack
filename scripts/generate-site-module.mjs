import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import { readSiteI18nManifest } from './lib/site-i18n-pages.mjs';
import {
  readCurrentSiteLocalizedPricing,
  readCurrentSitePricing,
} from './lib/site-pricing.mjs';

function toModuleSource({
  site,
  sitePricing,
  siteLocalizedPricing,
  siteI18nManifest,
}) {
  return [
    `export const site = ${JSON.stringify(site, null, 2)} as const;`,
    `export const sitePricing = ${JSON.stringify(sitePricing, null, 2)} as const;`,
    `export const siteLocalizedPricing = ${JSON.stringify(siteLocalizedPricing, null, 2)} as const;`,
    `export const siteI18nManifest = ${JSON.stringify(siteI18nManifest, null, 2)} as const;`,
    '',
  ].join('\n');
}

async function main() {
  const siteKey = resolveRequiredSiteKey(process.env);
  const targetPath = resolve(process.cwd(), '.generated', 'site.ts');
  const site = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey,
  });
  const sitePricing = readCurrentSitePricing({
    rootDir: process.cwd(),
    site,
    siteKey,
  });
  const siteLocalizedPricing = readCurrentSiteLocalizedPricing({
    rootDir: process.cwd(),
    site,
    siteKey,
  });
  const siteI18nManifest = readSiteI18nManifest({
    rootDir: process.cwd(),
    siteKey,
  });

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(
    targetPath,
    toModuleSource({
      site,
      sitePricing,
      siteLocalizedPricing,
      siteI18nManifest,
    }),
    'utf8'
  );

  process.stdout.write(`[site] generated ${siteKey}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
