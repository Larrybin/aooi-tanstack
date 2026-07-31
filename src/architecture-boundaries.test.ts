import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const rootDir = process.cwd();
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const envReaders = new Set([
  'src/config/env-contract.ts',
  'src/config/load-dotenv-core.mjs',
  'src/config/public-env.ts',
  'src/config/server-auth-base-url.ts',
  'src/config/site-env.cjs',
  'src/infra/runtime/env.server.ts',
]);

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const pathname = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(pathname);
    return sourceExtensions.has(path.extname(entry.name)) ? [pathname] : [];
  });
}

function repoPath(filePath: string) {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function imports(filePath: string) {
  const source = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  return sourceFile.statements.flatMap((statement) =>
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier)
      ? [statement.moduleSpecifier.text]
      : []
  );
}

test('production code does not import the testing layer', () => {
  for (const root of ['apps/web/src', 'src', 'cloudflare']) {
    for (const filePath of listFiles(path.join(rootDir, root))) {
      const relative = repoPath(filePath);
      if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relative)) continue;
      for (const specifier of imports(filePath)) {
        assert.doesNotMatch(
          specifier,
          /(?:^@\/testing(?:\/|$)|^src\/testing(?:\/|$))/,
          `${relative} imports ${specifier}`
        );
      }
    }
  }
});

test('TanStack route entries import surfaces instead of infra adapters', () => {
  for (const filePath of listFiles(path.join(rootDir, 'apps/web/src/routes'))) {
    const relative = repoPath(filePath);
    for (const specifier of imports(filePath)) {
      assert.doesNotMatch(
        specifier,
        /^(?:next(?:\/|$)|next-intl(?:\/|$)|@\/app(?:\/|$)|@\/themes(?:\/|$)|@\/infra\/adapters(?:\/|$)|@\/domains\/[^/]+\/infra(?:\/|$))/,
        `${relative} imports ${specifier}`
      );
    }
  }
});

test('runtime environment reads stay behind the env contract boundary', () => {
  for (const root of ['apps/web/src', 'src', 'cloudflare']) {
    for (const filePath of listFiles(path.join(rootDir, root))) {
      const relative = repoPath(filePath);
      if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relative)) continue;
      if (!readFileSync(filePath, 'utf8').includes('process.env')) continue;
      assert.ok(envReaders.has(relative), `${relative} reads process.env`);
    }
  }
});
