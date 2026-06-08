import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import {
  readSiteI18nManifest,
  readSiteI18nPages,
} from './lib/site-i18n-pages.mjs';
import {
  readCurrentSiteLocalizedPricing,
  readCurrentSitePricing,
} from './lib/site-pricing.mjs';

function toConstExport(name, value) {
  const literal = JSON.stringify(value, null, 2);
  if (value === null) {
    return `export const ${name} = null;`;
  }

  return `export const ${name} = ${literal} as const;`;
}

function toModuleSource({
  site,
  sitePricing,
  siteLocalizedPricing,
  siteHomeContent,
  siteI18nPages,
  siteI18nManifest,
}) {
  return [
    toConstExport('site', site),
    toConstExport('sitePricing', sitePricing),
    toConstExport('siteLocalizedPricing', siteLocalizedPricing),
    toConstExport('siteHomeContent', siteHomeContent),
    toConstExport('siteI18nPages', siteI18nPages),
    toConstExport('siteI18nManifest', siteI18nManifest),
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
  const siteI18nPages = readSiteI18nPages({
    rootDir: process.cwd(),
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
      siteI18nPages,
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
