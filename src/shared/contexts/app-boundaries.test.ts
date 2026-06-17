import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../..');

async function readRepoFile(relativePath: string) {
  return readFile(path.resolve(repoRoot, relativePath), 'utf8');
}

async function collectSourceFiles(currentDirPath: string): Promise<string[]> {
  const entries = await readdir(currentDirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolvedPath = path.join(currentDirPath, entry.name);
      if (entry.isDirectory()) {
        return collectSourceFiles(resolvedPath);
      }

      return resolvedPath.endsWith('.ts') || resolvedPath.endsWith('.tsx')
        ? [resolvedPath]
        : [];
    })
  );

  return files.flat();
}

test('PublicAppProvider 不再在公共壳层读取 session、details 或 configs fallback', async () => {
  const content = await readRepoFile('src/shared/contexts/app.tsx');

  assert.equal(content.includes('useSession('), false);
  assert.equal(content.includes('/api/config/get-configs'), false);
  assert.equal(content.includes('get-user-info'), false);
});

test('landing shell 向 PublicAppProvider 注入 typed initial props', async () => {
  const shellFile = 'src/surfaces/landing/shell/landing-shell.view.tsx';
  const content = await readRepoFile(shellFile);

  assert.equal(content.includes('<PublicAppProvider'), true);
  assert.equal(content.includes('initialUiConfig='), true);
  assert.equal(content.includes('initialAuthSettings='), true);
  assert.equal(content.includes('initialBillingSettings='), true);
  assert.equal(content.includes('initialConfigs='), false);
});

test('product home route data keeps product shells registered explicitly', async () => {
  const content = await readRepoFile(
    'src/server/landing/product-home-route-data.ts'
  );

  assert.equal(content.includes("case 'ai-remover':"), true);
  assert.equal(content.includes("case 'background-remover':"), true);
  assert.equal(content.includes("case 'text-to-speech-generator':"), true);
  assert.equal(content.includes("case 'mp4-compressor':"), true);
  assert.equal(content.includes("siteKey === 'ai-remover'"), false);
});

test('landing shell 不再直接读取 settings runtime query', async () => {
  const content = await readRepoFile(
    'src/surfaces/landing/shell/landing-shell.view.tsx'
  );

  assert.equal(content.includes('settings-runtime.query'), false);
});

test('仓库源码不再引用旧的 get-user-info 路径', async () => {
  const srcRoot = path.resolve(repoRoot, 'src');

  for (const file of await collectSourceFiles(srcRoot)) {
    if (file.endsWith('app-boundaries.test.ts')) {
      continue;
    }
    if (/\.(test|spec)\.tsx?$/.test(file)) {
      continue;
    }

    const content = await readFile(file, 'utf8');
    assert.equal(
      content.includes('/api/user/get-user-info'),
      false,
      path.relative(repoRoot, file)
    );
  }
});

test('公共消费方不再在首屏隐式读取 useSession', async () => {
  const filesToCheck = [
    'src/surfaces/landing/shell/landing-shell.view.tsx',
    'src/surfaces/landing/home/home.view.tsx',
    'src/surfaces/landing/home/product-home.view.tsx',
    'src/surfaces/landing/pricing/pricing.view.tsx',
  ];

  for (const file of filesToCheck) {
    const content = await readRepoFile(file);
    assert.equal(content.includes('useSession('), false, file);
  }
});

test('TanStack root route owns html locale without Next i18n metadata', async () => {
  const content = await readRepoFile('apps/web/src/routes/__root.tsx');

  assert.equal(content.includes('<html lang={locale} dir={dir}>'), true);
  assert.equal(content.includes('NextIntlClientProvider'), false);
  assert.equal(content.includes('generateMetadata'), false);
});

test('shared/common 不再持有 markdown-it 解析器实现', async () => {
  assert.equal(
    fs.existsSync(
      path.resolve(repoRoot, 'src/shared/blocks/common/markdown-content.tsx')
    ),
    false
  );
  assert.equal(
    fs.existsSync(
      path.resolve(repoRoot, 'src/shared/blocks/common/markdown-preview.tsx')
    ),
    false
  );
});

test('非 payment surface 不允许直接 import payment provider 实现', async () => {
  const srcRoot = path.resolve(repoRoot, 'src');
  const allowedPrefixes = [path.resolve(srcRoot, 'infra/adapters/payment')];
  const providerImportPatterns = [
    '@/infra/adapters/payment/stripe',
    '@/infra/adapters/payment/paypal',
    '@/infra/adapters/payment/creem',
  ];

  for (const file of await collectSourceFiles(srcRoot)) {
    if (file.endsWith('app-boundaries.test.ts')) {
      continue;
    }
    if (/\.(test|spec)\.tsx?$/.test(file)) {
      continue;
    }

    if (
      allowedPrefixes.some((allowedPrefix) => file.startsWith(allowedPrefix))
    ) {
      continue;
    }

    const content = await readFile(file, 'utf8');
    for (const importPath of providerImportPatterns) {
      assert.equal(
        content.includes(importPath),
        false,
        `${path.relative(repoRoot, file)} 不应直接引用 ${importPath}`
      );
    }
  }
});
