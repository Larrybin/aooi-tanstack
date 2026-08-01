import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSiteBuildPaths } from './lib/build-paths';
import { listConfiguredSiteKeys } from './lib/site-config';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATE_SITE_MODULE = resolve(
  ROOT_DIR,
  'scripts/generate-site-module.ts'
);
const GENERATE_CONTENT_MODULE = resolve(
  ROOT_DIR,
  'scripts/generate-content-source-module.mts'
);
const VERIFY_SITE_HOME = `
  const serverNamespace = await import('@/site-home-server');
  const server = serverNamespace.default ?? serverNamespace;
  const { resolveSiteHomeRouteData } = server;
  const data = await resolveSiteHomeRouteData('en');
  if (!data) throw new Error('site home returned null for en');
  const isProduct = 'productHome' in data;
  const isGeneric = 'page' in data;
  if (isProduct === isGeneric) {
    throw new Error('site home must expose exactly one concrete data shape');
  }
  process.stdout.write(isProduct ? 'product' : 'generic');
`;

function siteEnv(siteKey: string) {
  const paths = resolveSiteBuildPaths({ rootDir: ROOT_DIR, siteKey, env: {} });
  return {
    ...process.env,
    SITE: siteKey,
    AOOI_GENERATED_DIR: paths.generatedDir,
    AOOI_DIST_DIR: paths.distDir,
    AOOI_SITE_TSCONFIG: paths.tsconfigPath,
    TSX_TSCONFIG_PATH: paths.tsconfigPath,
  };
}

function generateSiteModule(siteKey: string) {
  const env: NodeJS.ProcessEnv = siteEnv(siteKey);
  delete env.TSX_TSCONFIG_PATH;
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', GENERATE_SITE_MODULE],
    { cwd: ROOT_DIR, env, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
}

function generateContentModule(siteKey: string) {
  return spawnSync(
    process.execPath,
    ['--import', 'tsx', GENERATE_CONTENT_MODULE],
    {
      cwd: ROOT_DIR,
      env: siteEnv(siteKey),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
}

function verifySiteHome(siteKey: string) {
  return spawnSync(
    process.execPath,
    [
      '--conditions=react-server',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      VERIFY_SITE_HOME,
    ],
    {
      cwd: ROOT_DIR,
      env: siteEnv(siteKey),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }
  );
}

function formatFailure(
  siteKey: string,
  phase: string,
  result: ReturnType<typeof spawnSync>
) {
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim();
  return `${siteKey} ${phase} failed:\n${output || `exited with code ${result.status ?? 1}`}`;
}

const failures: string[] = [];
for (const siteKey of listConfiguredSiteKeys(ROOT_DIR)) {
  const generateResult = generateSiteModule(siteKey);
  if (generateResult.status !== 0) {
    failures.push(formatFailure(siteKey, 'generation', generateResult));
    continue;
  }

  const contentResult = generateContentModule(siteKey);
  if (contentResult.status !== 0) {
    failures.push(formatFailure(siteKey, 'content generation', contentResult));
    continue;
  }

  const verifyResult = verifySiteHome(siteKey);
  if (verifyResult.status !== 0) {
    failures.push(
      formatFailure(siteKey, 'react-server behavior', verifyResult)
    );
    continue;
  }

  const shape = verifyResult.stdout.trim();
  process.stdout.write(`[site-home-server] ${siteKey}: ${shape} pass\n`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n\n')}\n`);
  process.exit(1);
}
