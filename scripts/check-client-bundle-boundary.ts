import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { resolveSiteBuildPaths } from './lib/build-paths';
import { resolveRequiredSiteKey } from './lib/site-config';

const root = process.cwd();
const siteKey = resolveRequiredSiteKey();
const clientDir = path.join(
  resolveSiteBuildPaths({ rootDir: root, siteKey }).distDir,
  'client'
);
const forbiddenTerms = [
  'DATABASE_URL',
  'Database schema mismatch',
  'CREATE SCHEMA IF NOT EXISTS',
  'information_schema.columns',
  '__drizzle_migrations',
  'node:async_hooks',
  'node:net',
  'node:tls',
  'postgres',
];

function walk(currentPath: string, files: string[] = []) {
  if (!existsSync(currentPath)) return files;
  const stats = statSync(currentPath);
  if (stats.isFile()) {
    if (/\.(?:js|mjs|cjs)$/.test(currentPath)) files.push(currentPath);
    return files;
  }
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    walk(path.join(currentPath, entry.name), files);
  }
  return files;
}

if (!existsSync(clientDir)) {
  throw new Error(
    `dist/${siteKey}/client is missing; run SITE=${siteKey} pnpm build first`
  );
}

const failures: string[] = [];
for (const file of walk(clientDir)) {
  const content = readFileSync(file, 'utf8');
  for (const term of forbiddenTerms) {
    if (content.includes(term)) {
      failures.push(`${path.relative(root, file)} contains ${term}`);
    }
  }
}

if (failures.length > 0) {
  console.error('Client bundle contains server-only markers:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('client bundle boundary ok');
