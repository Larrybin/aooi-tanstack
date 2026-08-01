import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const legacyFiles = [
  'scripts/run-with-site.mjs',
  'scripts/generate-site-module.mjs',
  'scripts/generate-content-source-module.mjs',
  'scripts/check-site-i18n.mjs',
  'scripts/check-client-bundle-boundary.mjs',
  'scripts/run-tests.mjs',
  'scripts/check-site-home-server-imports.mjs',
  'src/config/load-dotenv-core.mjs',
  'src/config/site-env.cjs',
];

test('core build and release closure is TypeScript-only', () => {
  for (const file of legacyFiles) {
    assert.equal(existsSync(file), false, file);
  }

  const tsconfig = JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
    include?: string[];
  };
  const scriptsTsconfig = JSON.parse(
    readFileSync('tsconfig.scripts.json', 'utf8')
  ) as {
    include?: string[];
    compilerOptions?: Record<string, unknown>;
  };
  for (const file of [
    'scripts/run-with-site.ts',
    'scripts/generate-site-module.ts',
    'scripts/generate-content-source-module.mts',
    'scripts/generate-paraglide.ts',
    'scripts/check-site-i18n.ts',
    'scripts/check-client-bundle-boundary.ts',
    'scripts/run-tests.ts',
    'scripts/check-site-home-server-imports.ts',
    'src/config/load-dotenv-core.ts',
    'src/config/site-env.ts',
  ]) {
    assert.ok(scriptsTsconfig.include?.includes(file), file);
  }
  assert.ok(tsconfig.include?.includes('src/**/*.ts'));
  assert.equal(scriptsTsconfig.compilerOptions?.strict, undefined);
  assert.equal(scriptsTsconfig.compilerOptions?.strictNullChecks, undefined);
  assert.equal(scriptsTsconfig.compilerOptions?.noImplicitAny, undefined);
  assert.equal(existsSync('src/paraglide'), false);
  assert.deepEqual(
    (
      JSON.parse(readFileSync('tsconfig.json', 'utf8')) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      }
    ).compilerOptions?.paths?.['@/paraglide/*'],
    ['./.generated/sites/dev-local/paraglide/*']
  );
});

test('core scripts pass the repository strict TypeScript contract', () => {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'tsc',
      '--project',
      'tsconfig.scripts.json',
      '--noEmit',
      '--pretty',
      'false',
      '--incremental',
      'false',
      '--strict',
      'true',
      '--strictNullChecks',
      'true',
      '--noImplicitAny',
      'true',
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('core TypeScript entrypoints do not import local JavaScript helpers', () => {
  const roots = [
    'scripts/ci.ts',
    'scripts/site-gate.ts',
    'scripts/cloudflare.ts',
    'scripts/run-with-site.ts',
    'scripts/generate-site-module.ts',
    'scripts/generate-content-source-module.mts',
    'scripts/check-site-i18n.ts',
    'scripts/check-client-bundle-boundary.ts',
    'scripts/run-tests.ts',
    'scripts/check-site-home-server-imports.ts',
  ];
  const visited = new Set<string>();
  const pending = [...roots];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );

    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        continue;
      }
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith('.')) continue;
      assert.doesNotMatch(specifier, /\.(?:mjs|cjs|js)$/);

      const base = path.resolve(path.dirname(file), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`].find(
        existsSync
      );
      if (resolved) pending.push(path.relative(process.cwd(), resolved));
    }
  }
});
