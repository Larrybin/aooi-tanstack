import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import { readCurrentSitePricing } from './lib/site-pricing.mjs';

function toModuleSource({ site, sitePricing }) {
  return [
    `export const site = ${JSON.stringify(site, null, 2)} as const;`,
    `export const sitePricing = ${JSON.stringify(sitePricing, null, 2)} as const;`,
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

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, toModuleSource({ site, sitePricing }), 'utf8');

  process.stdout.write(`[site] generated ${siteKey}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
