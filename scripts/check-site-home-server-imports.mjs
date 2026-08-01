import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listConfiguredSiteKeys } from './lib/site-config.mjs';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GENERATE_SITE_MODULE = resolve(
  ROOT_DIR,
  'scripts/generate-site-module.mjs'
);
const IMPORT_HOME_RESOLVER =
  "await import('./src/server/landing/home-route-resolver.ts')";

function runNode(args, siteKey) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT_DIR,
    env: { ...process.env, SITE: siteKey },
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function formatFailure(siteKey, phase, result) {
  const output = `${result.stderr ?? ''}\n${result.stdout ?? ''}`.trim();
  const detail = output || `exited with code ${result.status ?? 1}`;
  return `${siteKey} ${phase} failed:\n${detail}`;
}

function generateSiteModule(siteKey) {
  return runNode([GENERATE_SITE_MODULE], siteKey);
}

function importHomeRouteResolver(siteKey) {
  return runNode(
    [
      '--conditions=react-server',
      '--import',
      'tsx',
      '--input-type=module',
      '--eval',
      IMPORT_HOME_RESOLVER,
    ],
    siteKey
  );
}

const originalSiteKey = process.env.SITE?.trim() || 'dev-local';
const failures = [];

try {
  for (const siteKey of listConfiguredSiteKeys(ROOT_DIR)) {
    const generateResult = generateSiteModule(siteKey);
    if (generateResult.status !== 0) {
      failures.push(formatFailure(siteKey, 'generation', generateResult));
      continue;
    }

    const importResult = importHomeRouteResolver(siteKey);
    if (importResult.status !== 0) {
      failures.push(
        formatFailure(siteKey, 'react-server import', importResult)
      );
      continue;
    }

    process.stdout.write(`[site-home-server] ${siteKey}: pass\n`);
  }
} finally {
  const restoreResult = generateSiteModule(originalSiteKey);
  if (restoreResult.status !== 0) {
    failures.push(
      formatFailure(
        originalSiteKey,
        'generated-site restoration',
        restoreResult
      )
    );
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n\n')}\n`);
  process.exit(1);
}
