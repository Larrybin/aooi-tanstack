import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const checkerPath = path.resolve(
  process.cwd(),
  'scripts/check-gate-5-6-no-next.mjs'
);

function withTempProject(fn: (rootDir: string) => void | Promise<void>) {
  return async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-gate-5-6-'));
    try {
      write(rootDir, 'package.json', '{}\n');
      await fn(rootDir);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

function write(rootDir: string, relativePath: string, content: string) {
  const fullPath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

test(
  'Gate 5.6 checker fails active Cloudflare OpenNext cache bindings',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'wrangler.cloudflare.toml',
      `
[[r2_buckets]]
binding = "NEXT_INC_CACHE_R2_BUCKET"
bucket_name = "demo-opennext-cache"

[[durable_objects.bindings]]
name = "NEXT_CACHE_DO_QUEUE"
class_name = "DOQueueHandler"
`
    );

    assert.throws(
      () => {
        execFileSync(process.execPath, [checkerPath], {
          cwd: rootDir,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      },
      (error: unknown) => {
        if (!(error instanceof Error) || !('stdout' in error)) return false;
        const output = `${String(error.stdout)}\n${'stderr' in error ? String(error.stderr) : ''}`;
        return (
          /wrangler\.cloudflare\.toml:3 NEXT_INC_CACHE_R2_BUCKET/.test(
            output
          ) &&
          /wrangler\.cloudflare\.toml:4 opennext-cache/.test(output) &&
          /wrangler\.cloudflare\.toml:7 NEXT_CACHE_DO_QUEUE/.test(output)
        );
      }
    );
  })
);
