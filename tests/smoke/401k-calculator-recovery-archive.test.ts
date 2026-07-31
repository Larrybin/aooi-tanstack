import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import test from 'node:test';

const archiveDir = resolve(
  process.cwd(),
  'docs/archive/401k-calculator-recovery'
);

const forbiddenPatterns: Array<[RegExp, string]> = [
  [/\bcfat_[A-Za-z0-9_-]{20,}\b/u, 'Cloudflare API token'],
  [/"account_id"\s*:/u, 'Cloudflare account ID field'],
  [/"account_name"\s*:/u, 'Cloudflare account name field'],
  [/"workers_subdomain"\s*:/u, 'Cloudflare Workers subdomain field'],
  [/gmail\.com'?s Account/iu, 'Cloudflare account display name'],
  [/token-verify/iu, 'token verification response'],
  [/wrangler-whoami/iu, 'Wrangler identity response'],
  [/recovery-raw/iu, 'raw recovery directory reference'],
  [/node_modules/iu, 'standalone dependency directory'],
  [/package-lock\.json/iu, 'standalone lockfile'],
  [/wrangler\.jsonc/iu, 'standalone Worker runtime config'],
];

test('401k recovery archive contains only sanitized evidence', () => {
  const files = collectFiles(archiveDir);

  assert.ok(files.length > 0);
  for (const file of files) {
    const repoPath = relative(process.cwd(), file);
    for (const [pattern, label] of forbiddenPatterns) {
      assert.doesNotMatch(repoPath, pattern, `${repoPath} exposes ${label}`);
    }

    if (extname(file) === '.png') continue;
    const content = readFileSync(file, 'utf8');
    for (const [pattern, label] of forbiddenPatterns) {
      assert.doesNotMatch(content, pattern, `${repoPath} exposes ${label}`);
    }
  }
});

function collectFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}
