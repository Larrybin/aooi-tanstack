import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

test('generic and product sites expose concrete server-safe home contracts', () => {
  const result = spawnSync('pnpm', ['site-home-server:check'], {
    cwd: process.cwd(),
    env: { ...process.env, SITE: 'dev-local' },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /\[site-home-server\] dev-local: generic pass/);
  assert.match(
    result.stdout,
    /\[site-home-server\] 401k-calculator: product pass/
  );
});

test('home loader types flow without HomeRouteData assertions', () => {
  for (const filePath of [
    'src/surfaces/landing/home/home.data.ts',
    'apps/web/src/routes/index.tsx',
  ]) {
    const sourceFile = ts.createSourceFile(
      filePath,
      readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const assertions: string[] = [];

    function visit(node: ts.Node): void {
      if (
        ts.isAsExpression(node) &&
        node.type.getText(sourceFile).includes('HomeRouteData')
      ) {
        assertions.push(node.getText(sourceFile));
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    assert.deepEqual(assertions, [], filePath);
  }
});
