import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

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

function toImportSpecifier(fromPath, targetPath) {
  const repoPath = relative(dirname(fromPath), targetPath).split(sep).join('/');
  return repoPath.startsWith('.') ? repoPath : `./${repoPath}`;
}

async function main() {
  const rootDir = process.cwd();
  const siteKey = resolveRequiredSiteKey(process.env);
  const generatedDir = resolve(
    rootDir,
    process.env.AOOI_GENERATED_DIR?.trim() || '.generated'
  );
  const targetPath = resolve(generatedDir, 'site.ts');
  const site = readCurrentSiteConfig({
    rootDir,
    siteKey,
  });
  const sitePricing = readCurrentSitePricing({
    rootDir,
    site,
    siteKey,
  });
  const siteLocalizedPricing = readCurrentSiteLocalizedPricing({
    rootDir,
    site,
    siteKey,
  });
  const siteHomeContent = readCurrentSiteHomeContent({
    rootDir,
    site,
    siteKey,
  });
  const siteI18nPages = readSiteI18nPages({
    rootDir,
    siteKey,
  });
  const siteI18nManifest = readSiteI18nManifest({
    rootDir,
    siteKey,
  });

  await mkdir(dirname(targetPath), { recursive: true });
  const source = toModuleSource({
    site,
    sitePricing,
    siteLocalizedPricing,
    siteHomeContent,
    siteI18nPages,
    siteI18nManifest,
  });
  const tempPath = `${targetPath}.${process.pid}.tmp`;

  await writeFile(tempPath, source, 'utf8');
  await rename(tempPath, targetPath);

  for (const entry of ['entry.server.ts', 'entry.client.tsx']) {
    const entryTargetPath = resolve(generatedDir, entry);
    const entrySourcePath = resolve(
      rootDir,
      'sites',
      siteKey,
      entry.replace(/\.(?:ts|tsx)$/, '')
    );
    const entrySource = `export { default } from '${toImportSpecifier(entryTargetPath, entrySourcePath)}';\n`;
    const entryTempPath = `${entryTargetPath}.${process.pid}.tmp`;
    await writeFile(entryTempPath, entrySource, 'utf8');
    await rename(entryTempPath, entryTargetPath);
  }
  const homeTargetPath = resolve(generatedDir, 'site-home.tsx');
  const homeSource = `export * from '${toImportSpecifier(
    homeTargetPath,
    resolve(rootDir, 'sites', siteKey, 'home')
  )}';\n`;
  const homeTempPath = `${homeTargetPath}.${process.pid}.tmp`;
  await writeFile(homeTempPath, homeSource, 'utf8');
  await rename(homeTempPath, homeTargetPath);

  const homeServerTargetPath = resolve(generatedDir, 'site-home.server.ts');
  const homeServerSource = `export * from '${toImportSpecifier(
    homeServerTargetPath,
    resolve(rootDir, 'sites', siteKey, 'home.server')
  )}';\n`;
  const homeServerTempPath = `${homeServerTargetPath}.${process.pid}.tmp`;
  await writeFile(homeServerTempPath, homeServerSource, 'utf8');
  await rename(homeServerTempPath, homeServerTargetPath);

  process.stdout.write(`[site] generated ${siteKey}\n`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
