import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import { resolveSiteBuildPaths, toPosixPath } from './lib/build-paths';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.ts';
import {
  readSiteI18nManifest,
  readSiteI18nPages,
  type SiteI18nManifest,
  type SiteI18nPages,
} from './lib/site-i18n-pages.ts';
import {
  readCurrentSiteLocalizedPricing,
  readCurrentSitePricing,
  type SitePricing,
} from './lib/site-pricing.ts';
import type { SiteConfig } from './site-schema.ts';

type GeneratedSiteModuleInput = {
  site: SiteConfig;
  sitePricing: SitePricing | null;
  siteLocalizedPricing: Record<string, SitePricing>;
  siteHomeContent: Record<string, unknown> | null;
  siteI18nPages: SiteI18nPages;
  siteI18nManifest: SiteI18nManifest;
};

function toConstExport(name: string, value: unknown): string {
  const literal = JSON.stringify(value, null, 2);
  if (value === null) return `export const ${name} = null;`;
  return `export const ${name} = ${literal} as const;`;
}

function toModuleSource(input: GeneratedSiteModuleInput): string {
  return [
    toConstExport('site', input.site),
    toConstExport('sitePricing', input.sitePricing),
    toConstExport('siteLocalizedPricing', input.siteLocalizedPricing),
    toConstExport('siteHomeContent', input.siteHomeContent),
    toConstExport('siteI18nPages', input.siteI18nPages),
    toConstExport('siteI18nManifest', input.siteI18nManifest),
    '',
  ].join('\n');
}

function readCurrentSiteHomeContent({
  rootDir,
  site,
  siteKey,
}: {
  rootDir: string;
  site: SiteConfig;
  siteKey: string;
}): Record<string, unknown> | null {
  const content: Record<string, unknown> = {};

  for (const locale of site.i18n.supportedLocales) {
    const sourcePath = resolve(
      rootDir,
      'sites',
      siteKey,
      'content',
      `home.${locale}.json`
    );
    if (!existsSync(sourcePath)) continue;
    content[locale] = JSON.parse(readFileSync(sourcePath, 'utf8')) as unknown;
  }

  return Object.keys(content).length ? content : null;
}

function toImportSpecifier(fromPath: string, targetPath: string): string {
  const repoPath = relative(dirname(fromPath), targetPath).split(sep).join('/');
  return repoPath.startsWith('.') ? repoPath : `./${repoPath}`;
}

async function main(): Promise<void> {
  const rootDir = process.cwd();
  const siteKey = resolveRequiredSiteKey(process.env);
  const { generatedDir } = resolveSiteBuildPaths({
    rootDir,
    siteKey,
    env: process.env,
  });
  const targetPath = resolve(generatedDir, 'site.ts');
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  const sitePricing = readCurrentSitePricing({ rootDir, site, siteKey });
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
  const siteI18nPages = readSiteI18nPages({ rootDir, siteKey });
  const siteI18nManifest = readSiteI18nManifest({ rootDir, siteKey });

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

  for (const generatedEntry of [
    { name: 'site-home.tsx', target: 'home' },
    { name: 'site-home.server.ts', target: 'home.server' },
  ]) {
    const outputPath = resolve(generatedDir, generatedEntry.name);
    const output = `export * from '${toImportSpecifier(
      outputPath,
      resolve(rootDir, 'sites', siteKey, generatedEntry.target)
    )}';\n`;
    const temporaryPath = `${outputPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, output, 'utf8');
    await rename(temporaryPath, outputPath);
  }

  const relativeRoot = toPosixPath(relative(generatedDir, rootDir)) || '.';
  const generatedRepoPath = toPosixPath(relative(rootDir, generatedDir));
  await writeFile(
    resolve(generatedDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        extends: `${relativeRoot}/tsconfig.json`,
        compilerOptions: {
          baseUrl: relativeRoot,
          paths: {
            '@/*': ['./src/*'],
            '@/site': [`./${generatedRepoPath}/site.ts`],
            '@/site-home': [`./${generatedRepoPath}/site-home.tsx`],
            '@/site-home-server': [
              `./${generatedRepoPath}/site-home.server.ts`,
            ],
            '@/content-source': [`./${generatedRepoPath}/content-source.ts`],
            '@/public-content': [`./${generatedRepoPath}/public-content.ts`],
            '@/route-tree': [`./${generatedRepoPath}/routeTree.gen.ts`],
            '@/paraglide/*': [`./${generatedRepoPath}/paraglide/*`],
          },
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  process.stdout.write(`[site] generated ${siteKey}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
