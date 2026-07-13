import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import test from 'node:test';

const REPO_ROOT = process.cwd();
const SCAN_ROOTS = ['src', 'cloudflare', 'tests'].map((dir) =>
  resolve(REPO_ROOT, dir)
);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const FORBIDDEN_GENERATED_DIRS = new Set(['dist', 'build', 'output']);
const STATIC_IMPORT_ALLOWLIST = new Set([
  resolve(REPO_ROOT, 'cloudflare/workers/router.ts'),
  resolve(REPO_ROOT, 'cloudflare/workers/state.ts'),
]);

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
      continue;
    }

    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
}

function readStaticImportSpecifiers(source: string) {
  const specifiers = new Set<string>();
  const importFromPattern =
    /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const sideEffectImportPattern = /^\s*import\s+['"]([^'"]+)['"]/gm;

  for (const pattern of [importFromPattern, sideEffectImportPattern]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers];
}

function isForbiddenGeneratedImport(specifier: string) {
  if (!specifier.startsWith('.')) {
    return false;
  }

  return specifier
    .split('/')
    .some((segment) => FORBIDDEN_GENERATED_DIRS.has(segment));
}

test('仓库源码不允许顶层静态 import 本地生成目录', async () => {
  const offenders: string[] = [];
  const sourceFiles = (
    await Promise.all(SCAN_ROOTS.map((root) => collectSourceFiles(root)))
  ).flat();

  for (const filePath of sourceFiles) {
    if (STATIC_IMPORT_ALLOWLIST.has(filePath)) {
      continue;
    }

    const content = await readFile(filePath, 'utf8');
    const offendingSpecifiers = readStaticImportSpecifiers(content).filter(
      isForbiddenGeneratedImport
    );

    for (const specifier of offendingSpecifiers) {
      offenders.push(`${relative(REPO_ROOT, filePath)} -> ${specifier}`);
    }
  }

  assert.deepEqual(offenders, []);
});
