import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const checkerPath = path.resolve(
  process.cwd(),
  'scripts/check-gate-5-3-non-app-next-deps.mjs'
);

function withTempProject(fn: (rootDir: string) => void | Promise<void>) {
  return async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-gate-5-3-'));
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
  'Gate 5.3 checker detects multi-line static imports',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'scripts/multiline.ts',
      "import {\n  useTranslations,\n} from 'next-intl';\n"
    );

    const output = execFileSync(process.execPath, [checkerPath, '--report'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    assert.match(output, /scripts\/multiline\.ts:3 next-intl/);
  })
);

test(
  'Gate 5.3 checker fails active blockers from multi-line imports',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'scripts/blocked.ts',
      "import {\n  loadEnvConfig,\n} from '@next/env';\n"
    );

    assert.throws(
      () => {
        execFileSync(process.execPath, [checkerPath], {
          cwd: rootDir,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      },
      (error: unknown) =>
        error instanceof Error &&
        'stdout' in error &&
        /scripts\/blocked\.ts:3 @next\/env/.test(String(error.stdout))
    );
  })
);
