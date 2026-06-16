import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

test(
  'Gate 5.3 checker defers reusable UI Next imports to Gate 5.6',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'src/shared/blocks/image.tsx',
      "import Image from 'next/image';\n"
    );
    write(
      rootDir,
      'src/shared/components/link.tsx',
      "import Link from 'next/link';\n"
    );
    write(
      rootDir,
      'src/extensions/script.tsx',
      "import Script from 'next/script';\n"
    );
    write(
      rootDir,
      'src/themes/default/blocks/image.tsx',
      "import Image from 'next/image';\n"
    );

    const output = execFileSync(process.execPath, [checkerPath, '--report'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    assert.match(
      output,
      /src\/shared\/blocks\/image\.tsx:1 next\/image \(non-app Next residue requires explicit owner gate before deletion\)/
    );
    assert.match(
      output,
      /src\/shared\/components\/link\.tsx:1 next\/link \(non-app Next residue requires explicit owner gate before deletion\)/
    );
    assert.match(
      output,
      /src\/extensions\/script\.tsx:1 next\/script \(non-app Next residue requires explicit owner gate before deletion\)/
    );
    assert.match(
      output,
      /src\/themes\/default\/blocks\/image\.tsx:1 next\/image \(UI\/provider component residue is classified; active TanStack reachability is checked by migration validator\)/
    );
  })
);

test(
  'Gate 5.3 checker avoids duplicate same-line .open-next hits',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'scripts/open-next.mjs',
      "import worker from './.open-next/worker.mjs';\n"
    );

    const output = execFileSync(process.execPath, [checkerPath, '--report'], {
      cwd: rootDir,
      encoding: 'utf8',
    });
    const sameLineHits = output.match(/scripts\/open-next\.mjs:1/g) ?? [];

    assert.equal(sameLineHits.length, 1);
  })
);

test(
  'Gate 5.3 checker ignores migration checker implementation files',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'scripts/check-gate-5-4-server-only-markers.mjs',
      "const ignored = ['.open-next', 'server-only'];\n"
    );

    const output = execFileSync(process.execPath, [checkerPath, '--report'], {
      cwd: rootDir,
      encoding: 'utf8',
    });

    assert.doesNotMatch(output, /check-gate-5-4-server-only-markers/);
    assert.match(output, /Gate 5\.3 non-app Next dependency report: 0 hit/);
  })
);
