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

test('公共 layout 都必须向 PublicAppProvider 注入 typed initial props', async () => {
  const layoutFiles = [
    'src/themes/default/layouts/landing-marketing.tsx',
    'src/app/[locale]/(landing)/pricing/layout.tsx',
    'src/app/[locale]/(landing)/blog/layout.tsx',
    'src/app/[locale]/(landing)/activity/layout.tsx',
    'src/app/[locale]/(landing)/(ai)/layout.tsx',
    'src/app/[locale]/(landing)/settings/layout.tsx',
    'src/app/[locale]/(landing)/[slug]/layout.tsx',
    'src/app/[locale]/(chat)/layout.tsx',
    'src/app/[locale]/(admin)/layout.tsx',
  ];

  for (const layoutFile of layoutFiles) {
    const content = await readRepoFile(layoutFile);
    assert.equal(
      content.includes('<PublicAppProvider'),
      true,
      `${layoutFile} 必须使用 PublicAppProvider`
    );
    assert.equal(
      content.includes('initialUiConfig='),
      true,
      `${layoutFile} 必须传入 initialUiConfig`
    );
    assert.equal(
      content.includes('initialAuthSettings='),
      true,
      `${layoutFile} 必须传入 initialAuthSettings`
    );
    assert.equal(
      content.includes('initialBillingSettings='),
      true,
      `${layoutFile} 必须传入 initialBillingSettings`
    );
    assert.equal(
      content.includes('initialConfigs='),
      false,
      `${layoutFile} 不应继续传入 initialConfigs`
    );
  }
});

test('legal page layout uses the product shell registry instead of a single product special case', async () => {
  const content = await readRepoFile(
    'src/app/[locale]/(landing)/[slug]/layout.tsx'
  );

  assert.equal(
    content.includes(
      "import { getProductLanding } from '@/surfaces/public/product-landing';"
    ),
    true
  );
  assert.equal(content.includes('getProductLanding(siteKey)'), true);
  assert.equal(content.includes("siteKey === 'ai-remover'"), false);
});

test('themes/default/layouts 不再直接读取 settings runtime query', async () => {
  const layoutFiles = [
    'src/themes/default/layouts/landing.tsx',
    'src/themes/default/layouts/landing-marketing.tsx',
  ];

  for (const layoutFile of layoutFiles) {
    const content = await readRepoFile(layoutFile);
    assert.equal(
      content.includes('settings-runtime.query'),
      false,
      `${layoutFile} 不应再直接依赖 settings-runtime.query`
    );
  }
});

test('仓库源码不再引用旧的 get-user-info 路径', async () => {
  const filesToCheck = [
    'src/shared/contexts/app.tsx',
    'src/themes/default/blocks/pricing.tsx',
    'src/domains/ai/ui/image-generator.tsx',
    'src/domains/ai/ui/music-generator.tsx',
  ];

  for (const file of filesToCheck) {
    const content = await readRepoFile(file);
    assert.equal(content.includes('/api/user/get-user-info'), false, file);
  }
});

test('公共消费方不再在首屏隐式读取 useSession', async () => {
  const filesToCheck = [
    'src/themes/default/blocks/pricing.tsx',
    'src/domains/ai/ui/image-generator.tsx',
    'src/domains/ai/ui/music-generator.tsx',
  ];

  for (const file of filesToCheck) {
    const content = await readRepoFile(file);
    assert.equal(content.includes('useSession('), false, file);
  }
});

test('根 locale layout 默认不注入全量 messages，也不再挂全局动态 metadata', async () => {
  const content = await readRepoFile('src/app/[locale]/layout.tsx');

  assert.equal(
    content.includes(
      '<NextIntlClientProvider locale={locale} messages={null}>'
    ),
    true
  );
  assert.equal(content.includes('generateMetadata = getMetadata()'), false);
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
