import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const clientDir = path.join(root, 'dist/client');
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

function walk(currentPath, files = []) {
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
  throw new Error('dist/client is missing; run tanstack:build first');
}

const failures = [];
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
