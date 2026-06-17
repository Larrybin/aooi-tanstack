import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { protectedServerOnlyFiles } from '../scripts/gate-5-4-server-only-protected-files.mjs';

const checkerPath = path.resolve(
  process.cwd(),
  'scripts/check-gate-5-4-server-only-markers.mjs'
);
const protectedTarget = 'src/infra/adapters/storage/service.ts';

function withTempProject(fn: (rootDir: string) => void | Promise<void>) {
  return async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-gate-5-4-'));
    try {
      write(rootDir, 'package.json', {
        dependencies: { 'server-only': '^0.0.1' },
      });
      write(rootDir, 'vite.config.mts', 'export default {};\n');
      writeProtectedFiles(rootDir);
      await fn(rootDir);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

function write(
  rootDir: string,
  relativePath: string,
  content: string | Record<string, unknown>
) {
  const fullPath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  const fileContent =
    typeof content === 'string' ? content : `${JSON.stringify(content)}\n`;
  writeFileSync(fullPath, fileContent);
}

function writeProtectedFiles(rootDir: string) {
  for (const repoPath of protectedServerOnlyFiles) {
    write(rootDir, repoPath, 'export const protectedServerModule = true;\n');
  }
}

function runChecker(rootDir: string) {
  return execFileSync(process.execPath, [checkerPath], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function assertCheckerFails(rootDir: string, expected: RegExp) {
  assert.throws(
    () => runChecker(rootDir),
    (error: unknown) =>
      error instanceof Error &&
      'stdout' in error &&
      'stderr' in error &&
      expected.test(`${String(error.stdout)}\n${String(error.stderr)}`)
  );
}

test(
  'Gate 5.4 checker follows surface data files to protected modules',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'apps/web/src/routes/index.tsx',
      "import { loadSyntheticData } from '@/surfaces/synthetic/synthetic.data';\nexport const Route = { loader: () => loadSyntheticData() };\n"
    );
    write(
      rootDir,
      'src/surfaces/synthetic/synthetic.data.ts',
      `import { protectedServerModule } from '@/${protectedTarget.slice(4)}';\nexport function loadSyntheticData() { return protectedServerModule; }\n`
    );

    assertCheckerFails(rootDir, /protected reachability violations: 1/);
  })
);

test(
  'Gate 5.4 checker follows non-boundary src/server files to protected modules',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'apps/web/src/routes/index.tsx',
      "import { loadSyntheticData } from '@/surfaces/synthetic/synthetic.data';\nexport const Route = { loader: () => loadSyntheticData() };\n"
    );
    write(
      rootDir,
      'src/surfaces/synthetic/synthetic.data.ts',
      "import { loadSyntheticServerData } from '@/server/synthetic/data';\nexport function loadSyntheticData() { return loadSyntheticServerData(); }\n"
    );
    write(
      rootDir,
      'src/server/synthetic/data.ts',
      `import { protectedServerModule } from '@/${protectedTarget.slice(4)}';\nexport function loadSyntheticServerData() { return protectedServerModule; }\n`
    );

    assertCheckerFails(rootDir, /protected reachability violations: 1/);
  })
);

test(
  'Gate 5.4 checker allows explicit TanStack server function boundaries',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'apps/web/src/routes/index.tsx',
      "import { loadSyntheticData } from '@/surfaces/synthetic/synthetic.data';\nexport const Route = { loader: () => loadSyntheticData() };\n"
    );
    write(
      rootDir,
      'src/surfaces/synthetic/synthetic.data.ts',
      "import { loadSyntheticServerData } from '@/server/synthetic/data';\nexport function loadSyntheticData() { return loadSyntheticServerData(); }\n"
    );
    write(
      rootDir,
      'src/server/synthetic/data.ts',
      "import { createServerFn } from '@tanstack/react-start';\nexport const loadSyntheticServerData = createServerFn({ method: 'GET' }).handler(async () => {\n  const { loadSecret } = await import('./resolver');\n  return loadSecret();\n});\n"
    );
    write(
      rootDir,
      'src/server/synthetic/resolver.ts',
      `import { protectedServerModule } from '@/${protectedTarget.slice(4)}';\nexport function loadSecret() { return protectedServerModule; }\n`
    );

    const output = runChecker(rootDir);

    assert.match(output, /server boundary hit count: 1/);
    assert.match(output, /reachability violation count: 0/);
  })
);

test(
  'Gate 5.4 checker blocks use client files from importing protected modules',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'src/ui/client-entry.tsx',
      `'use client';
import { protectedServerModule } from '@/${protectedTarget.slice(4)}';
export function ClientEntry() { return String(protectedServerModule); }
`
    );

    assertCheckerFails(rootDir, /direct violation count: 1/);
  })
);

test(
  'Gate 5.4 checker blocks shared components from importing protected modules',
  withTempProject((rootDir) => {
    write(
      rootDir,
      'src/shared/components/leaky-widget.tsx',
      `import { protectedServerModule } from '@/${protectedTarget.slice(4)}';
export function LeakyWidget() { return String(protectedServerModule); }
`
    );

    assertCheckerFails(rootDir, /direct violation count: 1/);
  })
);

test(
  'Gate 5.4 checker allows missing server-only package after Gate 5.6',
  withTempProject((rootDir) => {
    write(rootDir, 'package.json', { dependencies: {} });

    const output = runChecker(rootDir);

    assert.match(output, /server-only package dependency: missing/);
    assert.match(output, /Gate 5\.4 server-only marker check passed/);
  })
);
