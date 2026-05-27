import { existsSync, readFileSync } from 'node:fs';
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
  siteHomeContent,
  siteI18nManifest,
}) {
  return [
    `export const site = ${JSON.stringify(site, null, 2)} as const;`,
    `export const sitePricing = ${JSON.stringify(sitePricing, null, 2)} as const;`,
    `export const siteLocalizedPricing = ${JSON.stringify(siteLocalizedPricing, null, 2)} as const;`,
    `export const siteHomeContent = ${JSON.stringify(siteHomeContent, null, 2)} as const;`,
    `export const siteI18nManifest = ${JSON.stringify(siteI18nManifest, null, 2)} as const;`,
    '',
  ].join('\n');
}

function readCurrentSiteHomeContent({ rootDir, site, siteKey }) {
  const content = {};

  for (const locale of site.i18n?.supportedLocales ?? []) {
    const sourcePath = resolve(
      rootDir,
      'sites',
      siteKey,
      'content',
      `home.${locale}.json`
    );
    if (!existsSync(sourcePath)) {
      continue;
    }

    content[locale] = JSON.parse(readFileSync(sourcePath, 'utf8'));
  }

  return Object.keys(content).length ? content : null;
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
  const siteHomeContent = readCurrentSiteHomeContent({
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
      siteHomeContent,
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
