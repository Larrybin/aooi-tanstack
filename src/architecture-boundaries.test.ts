import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { ARCHITECTURE_RULES } = require('../architecture-rules.cjs');

const repoRoot = process.cwd();
const srcRoot = path.resolve(repoRoot, 'src');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const DIRS_TO_SKIP = new Set(['.next', 'node_modules']);
const SITE_IDENTITY_SETTING_KEYS = [
  ['app', 'name'],
  ['app', 'url'],
  ['general', 'support', 'email'],
  ['app', 'logo'],
  ['app', 'favicon'],
  ['app', 'og', 'image'],
  ['storage', 'public', 'base', 'url'],
].map((parts) => parts.join('_'));

type DirtyImportRule = {
  label: string;
  pattern: RegExp;
  baseline: number;
};

async function collectSourceFiles(currentDir: string): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (DIRS_TO_SKIP.has(entry.name)) continue;
      files.push(
        ...(await collectSourceFiles(path.join(currentDir, entry.name)))
      );
      continue;
    }

    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;

    files.push(path.join(currentDir, entry.name));
  }

  return files;
}

function toRepoPath(filePath: string) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function readSourceFiles() {
  const files = await collectSourceFiles(srcRoot);
  return Promise.all(
    files.map(async (filePath) => ({
      filePath,
      repoPath: toRepoPath(filePath),
      content: await readFile(filePath, 'utf8'),
    }))
  );
}

function countMatches(content: string, pattern: RegExp) {
  return [
    ...content.matchAll(
      new RegExp(
        pattern,
        pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
      )
    ),
  ].length;
}

function isTestFile(repoPath: string) {
  return /\.(test|spec)\.tsx?$/.test(repoPath);
}

const importPatterns = {
  sharedModels:
    /(?:from\s+['"]@\/shared\/models(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/shared\/models(?:\/[^'"]*)?['"]\s*\))/g,
  sharedServices:
    /(?:from\s+['"]@\/shared\/services(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/shared\/services(?:\/[^'"]*)?['"]\s*\))/g,
  core: /(?:from\s+['"]@\/core(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/core(?:\/[^'"]*)?['"]\s*\))/g,
  features:
    /(?:from\s+['"]@\/features(?:\/[^'"]*)?['"]|import\s*\(\s*['"]@\/features(?:\/[^'"]*)?['"]\s*\))/g,
};

const dirtyImportRules: DirtyImportRule[] = ARCHITECTURE_RULES.dirtyImports.map(
  (label: string) => {
    switch (label) {
      case '@/shared/models':
        return { label, pattern: importPatterns.sharedModels, baseline: 0 };
      case '@/shared/services':
        return { label, pattern: importPatterns.sharedServices, baseline: 0 };
      case '@/core':
        return { label, pattern: importPatterns.core, baseline: 0 };
      case '@/features':
        return { label, pattern: importPatterns.features, baseline: 0 };
      default:
        throw new Error(`Unsupported dirty import rule: ${label}`);
    }
  }
);

const publicCompositionPathPatterns =
  ARCHITECTURE_RULES.publicCompositionPathPatterns.map(
    (pattern: string) => new RegExp(pattern)
  );
const domainForbiddenImportPatterns =
  ARCHITECTURE_RULES.domainForbiddenImports.map(
    (pattern: string) => new RegExp(pattern)
  );
const applicationAllowedPlatformImportPatterns =
  ARCHITECTURE_RULES.applicationAllowedPlatformImports.map(
    (pattern: string) => new RegExp(pattern)
  );
const appOnlyFacadeImportPatterns =
  ARCHITECTURE_RULES.appOnlyFacadeImportPatterns.map(
    (pattern: string) => new RegExp(pattern)
  );
const applicationPlatformImportExceptions =
  ARCHITECTURE_RULES.applicationPlatformImportExceptions.map(
    (exception: { file: string; imports: string[] }) => ({
      file: exception.file,
      imports: exception.imports.map((pattern: string) => new RegExp(pattern)),
    })
  );
const queryViewAllowedSameDomainApplicationPathPattern = new RegExp(
  ARCHITECTURE_RULES.queryViewAllowedSameDomainApplicationPathPattern
);
const sharedLibAllowedPathPatterns =
  ARCHITECTURE_RULES.sharedLibAllowedPathPatterns.map(
    (pattern: string) => new RegExp(pattern)
  );
const aggregationPathPattern = new RegExp(
  ARCHITECTURE_RULES.aggregation.pathPattern
);
const orchestrationPathPattern = new RegExp(
  ARCHITECTURE_RULES.orchestration.pathPattern
);

function isPublicCompositionFile(repoPath: string) {
  return publicCompositionPathPatterns.some((pattern: RegExp) =>
    pattern.test(repoPath)
  );
}

function readImportSpecifiers(source: string) {
  const specifiers = new Set<string>();
  const importFromPattern =
    /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/gm;
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;
  const sideEffectImportPattern = /^\s*import\s+['"]([^'"]+)['"]/gm;

  for (const pattern of [
    importFromPattern,
    dynamicImportPattern,
    sideEffectImportPattern,
  ]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) specifiers.add(specifier);
    }
  }

  return [...specifiers];
}

function parseDomainApplicationPath(repoPath: string) {
  const match = repoPath.match(/^src\/domains\/([^/]+)\/application\/(.+)$/);
  if (!match) return;

  return {
    domain: match[1],
    applicationPath: match[2],
  };
}

function isAggregationFile(repoPath: string) {
  return aggregationPathPattern.test(repoPath);
}

function isOrchestrationFile(repoPath: string) {
  return orchestrationPathPattern.test(repoPath);
}

function assertHasMarker(content: string, marker: string, repoPath: string) {
  assert.equal(
    content.includes(marker),
    true,
    `${repoPath} 必须包含 ${marker}`
  );
}

function assertHasPattern(
  content: string,
  pattern: string,
  repoPath: string,
  message: string
) {
  assert.equal(
    new RegExp(pattern).test(content),
    true,
    `${repoPath} ${message}`
  );
}

function countByDomain(files: Array<{ repoPath: string }>) {
  const counts = new Map<string, number>();
  for (const file of files) {
    const domain = file.repoPath.match(/^src\/domains\/([^/]+)\//)?.[1];
    assert.ok(domain, `${file.repoPath} 应属于明确 domain`);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  return counts;
}

function sourceFilesInDomain(
  files: Array<{ repoPath: string; content: string }>,
  domain: string
) {
  return files.filter(
    ({ repoPath }) =>
      !isTestFile(repoPath) && repoPath.startsWith(`src/domains/${domain}/`)
  );
}

function assertNoImporter(
  file: { repoPath: string; content: string },
  pattern: RegExp,
  message: string
) {
  for (const specifier of readImportSpecifiers(file.content)) {
    assert.equal(
      pattern.test(specifier),
      false,
      `${file.repoPath} ${message}: ${specifier}`
    );
  }
}

function isAllowedApplicationPlatformException(
  repoPath: string,
  specifier: string
) {
  const exception = applicationPlatformImportExceptions.find(
    (item: { file: string; imports: RegExp[] }) => item.file === repoPath
  );
  if (!exception) return false;

  return exception.imports.some((pattern: RegExp) => pattern.test(specifier));
}

test('architecture: 目标收敛目录必须存在', async () => {
  for (const requiredDir of ARCHITECTURE_RULES.requiredTargetDirectories) {
    const dirStat = await stat(path.resolve(repoRoot, requiredDir));
    assert.equal(
      dirStat.isDirectory(),
      true,
      `${requiredDir} 必须存在，避免后续能力继续落回 shared/core/features`
    );
  }
});

test('architecture: 旧架构目录已删除', async () => {
  for (const legacyDir of ARCHITECTURE_RULES.legacyArchitectureDirectories) {
    await assert.rejects(
      () => stat(path.resolve(repoRoot, legacyDir)),
      { code: 'ENOENT' },
      `${legacyDir} 不应继续存在，避免新代码落回旧业务层`
    );
  }
});

test('architecture: 旧脏入口引用保持归零', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) => repoPath !== 'src/architecture-boundaries.test.ts'
  );

  for (const rule of dirtyImportRules) {
    const count = files.reduce(
      (total, file) => total + countMatches(file.content, rule.pattern),
      0
    );

    assert.equal(
      count <= rule.baseline,
      true,
      `${rule.label} 引用数必须保持 ${rule.baseline}，当前为 ${count}`
    );
  }
});

test('architecture: runtime 只能通过 @/site 获取站点输入', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) => !isTestFile(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        /^@\/?sites(?:\/|$)|^sites(?:\/|$)|(?:^|\/)sites\//.test(specifier),
        false,
        `${file.repoPath} 不应导入 ${specifier}；运行时代码只能走 @/site`
      );
    }
  }
});

test('architecture: runtime 不得直接导入 .source 生成物', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) => !isTestFile(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        specifier === '@/.source' ||
          /^@\/\.source\//.test(specifier) ||
          /(?:^|\/)\.source(?:\/|$)/.test(specifier),
        false,
        `${file.repoPath} 不应导入 ${specifier}；运行时代码必须统一走 @/content-source`
      );
    }
  }
});

test('architecture: .source 只能作为生成器或测试边界存在', async () => {
  const allowedRepoPaths = new Set([
    '.generated/content-source.ts',
    'scripts/generate-content-source-module.mjs',
    'src/architecture-boundaries.test.ts',
    'tests/content-source-module.test.ts',
  ]);

  const files = await readSourceFiles();

  for (const file of files) {
    if (allowedRepoPaths.has(file.repoPath) || isTestFile(file.repoPath)) {
      continue;
    }

    assert.equal(
      /(?:^|\/)\.source(?:\/|$)/.test(file.content),
      false,
      `${file.repoPath} 不应依赖 .source；.source/** 只能作为生成器或测试边界存在`
    );
  }
});

test('architecture: 站点 identity 不允许从 settings/public-config 回流', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) => !isTestFile(repoPath)
  );

  for (const file of files) {
    for (const key of SITE_IDENTITY_SETTING_KEYS) {
      assert.equal(
        file.content.includes(key),
        false,
        `${file.repoPath} 不应包含旧站点 identity setting key: ${key}`
      );
    }
  }
});

test('architecture: canonical base 只能在 canonical helper 内构造', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) =>
      !isTestFile(repoPath) &&
      repoPath !== 'src/infra/url/canonical.ts' &&
      /^src\/(?:app|surfaces)\//.test(repoPath)
  );

  for (const file of files) {
    assert.equal(
      /metadataBase:\s*new URL/.test(file.content),
      false,
      `${file.repoPath} 不应直接构造 metadataBase；请使用 buildMetadataBaseUrl`
    );
    assert.equal(
      /new URL\([^)]*(?:site\.brand\.appUrl|brand\.appUrl)/.test(file.content),
      false,
      `${file.repoPath} 不应直接用 site brand URL 构造 canonical；请使用 canonical helper`
    );
  }
});

test('architecture: deploy/smoke 脚本不得通过 NEXT_PUBLIC_APP_URL 反推站点 identity', async () => {
  const scriptPaths = [
    path.resolve(repoRoot, 'scripts/run-cf-app-deploy.mjs'),
    path.resolve(repoRoot, 'scripts/run-cf-app-smoke.mjs'),
  ];

  for (const scriptPath of scriptPaths) {
    const content = await readFile(scriptPath, 'utf8');
    assert.equal(
      /process\.env\.NEXT_PUBLIC_APP_URL/.test(content),
      false,
      `${toRepoPath(scriptPath)} 不应通过 process.env.NEXT_PUBLIC_APP_URL 反推 identity`
    );
    assert.equal(
      /readQuotedTomlValue\([^)]*NEXT_PUBLIC_APP_URL/.test(content),
      false,
      `${toRepoPath(scriptPath)} 不应从 wrangler 内容反推 identity`
    );
  }
});

test('architecture: Batch 2 旧 facade 与旧 bag 输入必须保持归零', async () => {
  const files = await readSourceFiles();
  const forbiddenPatterns = [
    {
      pattern:
        /\breadRuntimeSettingsCached\b|\breadRuntimeSettingsFresh\b|\breadRuntimeSettingsSafe\b/,
      message: '不应继续使用旧 runtime settings facade',
    },
    {
      pattern: /\bgetPublicConfigsCached\b|\bgetPublicConfigsFresh\b/,
      message: '不应继续使用旧 public-config facade',
    },
    {
      pattern: /\bgetPaymentServiceWithConfigs\b/,
      message: 'payment 不应继续使用 configs bag 入口',
    },
    {
      pattern:
        /\bbuildStorageServiceWithConfigs\b|\bgetStorageServiceWithConfigs\b/,
      message: 'storage 不应继续接受 configs bag',
    },
    {
      pattern: /initialConfigs=/,
      message: 'PublicAppProvider 不应继续使用 initialConfigs',
    },
  ];

  for (const file of files) {
    if (isTestFile(file.repoPath)) {
      continue;
    }

    for (const rule of forbiddenPatterns) {
      assert.equal(
        rule.pattern.test(file.content),
        false,
        `${file.repoPath} ${rule.message}`
      );
    }
  }
});

test('architecture: email provider 只能通过统一 service factory 构造', async () => {
  const files = await readSourceFiles();
  const emailServiceFactoryPath = 'src/infra/adapters/email/service-builder.ts';

  for (const file of files) {
    if (isTestFile(file.repoPath)) continue;

    assert.equal(
      /\bcreateResendProvider\b/.test(file.content),
      false,
      `${file.repoPath} 不应暴露或调用 raw Resend provider factory`
    );

    if (!/\bnew\s+ResendProvider\b/.test(file.content)) continue;

    assert.equal(
      file.repoPath,
      emailServiceFactoryPath,
      `${file.repoPath} 不应绕过 email service factory 构造 ResendProvider`
    );
  }
});

test('architecture: settings runtime query 只暴露 cached/fresh reader 与 bindings', async () => {
  const files = await readSourceFiles();
  const queryFile = files.find(
    ({ repoPath }) =>
      repoPath === 'src/domains/settings/application/settings-runtime.query.ts'
  );

  assert.ok(queryFile, 'settings-runtime.query.ts 应存在');

  const exportedFunctions = [
    ...queryFile.content.matchAll(/export\s+function\s+(\w+)\s*\(/g),
    ...queryFile.content.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g),
  ].map((match) => match[1]);

  for (const name of exportedFunctions) {
    assert.equal(
      /^read[A-Z]\w+(?:Cached|Fresh)$/.test(name) ||
        name === 'readEmailRuntimeBindings',
      true,
      `settings-runtime.query.ts 不应暴露第三种 reader 语义: ${name}`
    );
  }
});

test('architecture: 新目标 domain 层不依赖入站层、adapter 或 HTTP schema', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/domain\//.test(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        domainForbiddenImportPatterns.some((pattern: RegExp) =>
          pattern.test(specifier)
        ),
        false,
        `${file.repoPath} 不应依赖 ${specifier}`
      );
    }
  }
});

test('architecture: 新目标目录不回引旧架构入口', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) =>
      /^src\/(?:domains|surfaces|infra)\//.test(repoPath) &&
      !isTestFile(repoPath)
  );
  const forbiddenLegacyImportPattern =
    /@\/(?:core|features|shared\/models|shared\/services)(?:\/|['"])/;

  for (const file of files) {
    assert.equal(
      forbiddenLegacyImportPattern.test(file.content),
      false,
      `${file.repoPath} 不应回引 core/features/shared models/services`
    );
  }
});

test('architecture: access-control domain/application 不包含 Web 拒绝行为', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/access-control\//.test(repoPath)
  );

  for (const file of files) {
    assert.equal(
      /next\/navigation|redirect\s*\(|notFound\s*\(/.test(file.content),
      false,
      `${file.repoPath} 不应包含 redirect/notFound/next/navigation`
    );
  }
});

test('architecture: content domain 不拥有 composition/platform/runtime 职责', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/content\//.test(repoPath)
  );
  const forbiddenContentImportPattern =
    /@\/(?:app|infra\/platform\/i18n|infra\/runtime|themes)(?:\/|['"])|next\/navigation|generateMetadata|Metadata\s+from\s+['"]next/;

  for (const file of files) {
    assert.equal(
      forbiddenContentImportPattern.test(file.content),
      false,
      `${file.repoPath} 不应拥有 SEO/i18n runtime/route segmentation/theme rendering 职责`
    );
  }
});

test('architecture: shared/schemas/api 只保存 HTTP wire contract', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/shared\/schemas\/api\//.test(repoPath)
  );

  for (const file of files) {
    assert.equal(
      /@\/(?:domains|shared\/models|shared\/services|infra|core|features)(?:\/|['"])/.test(
        file.content
      ),
      false,
      `${file.repoPath} 不应依赖业务模块或 infra`
    );
  }
});

test('architecture: Public Composition Layer 只导入只读 domain 入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    isPublicCompositionFile(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        /^@\/infra\/adapters(?:\/|$)/.test(specifier),
        false,
        `${file.repoPath} 不应导入 infra/adapters`
      );

      const match = specifier.match(/^@\/domains\/[^/]+\/application\/(.+)$/);
      if (!match) continue;

      assert.equal(
        queryViewAllowedSameDomainApplicationPathPattern.test(match[1]),
        true,
        `${file.repoPath} 只能导入受控只读 domain 入口: ${specifier}`
      );
    }
  }
});

test('architecture: settings 不拥有业务域实现', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/settings\//.test(repoPath)
  );
  const forbiddenImportPattern = new RegExp(
    `^@/(?:domains|core)/(?:${ARCHITECTURE_RULES.settingsForbiddenBusinessImports.join('|')})(?:/|$)`
  );

  for (const file of files) {
    if (isTestFile(file.repoPath)) continue;
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        forbiddenImportPattern.test(specifier),
        false,
        `${file.repoPath} 不应依赖 ${specifier} 业务实现`
      );
    }
  }
});

test('architecture: settings 内部边界保持单向且 index 仅做聚合导出', async () => {
  const files = await readSourceFiles();
  const settingsIndex = files.find(
    ({ repoPath }) => repoPath === 'src/domains/settings/index.ts'
  );
  const settingsTabs = files.find(
    ({ repoPath }) => repoPath === 'src/domains/settings/tabs.ts'
  );
  const settingsSiteAware = files.find(
    ({ repoPath }) => repoPath === 'src/domains/settings/site-aware.ts'
  );
  const settingsRegistry = files.find(
    ({ repoPath }) => repoPath === 'src/domains/settings/registry.ts'
  );

  assert.ok(settingsIndex, 'settings/index.ts 应存在');
  assert.ok(settingsTabs, 'settings/tabs.ts 应存在');
  assert.ok(settingsSiteAware, 'settings/site-aware.ts 应存在');
  assert.ok(settingsRegistry, 'settings/registry.ts 应存在');

  const indexImports = readImportSpecifiers(settingsIndex.content);
  assert.equal(
    /export\s+async\s+function|export\s+function/.test(settingsIndex.content),
    false,
    'settings/index.ts 只能做聚合导出，不应定义运行时函数'
  );
  assert.equal(
    /^\s*import\s/m.test(settingsIndex.content),
    false,
    'settings/index.ts 不应通过 import 参与内部实现依赖'
  );
  assert.equal(
    indexImports.every((specifier) =>
      [
        './registry',
        './tabs',
        './settings-form-mapper',
        './settings-normalizers',
        './types',
      ].includes(specifier)
    ),
    true,
    'settings/index.ts 只允许聚合导出受控子模块'
  );

  const tabsImports = readImportSpecifiers(settingsTabs.content);
  assert.equal(
    tabsImports.includes('./index'),
    false,
    'settings/tabs.ts 不得反向依赖 settings/index.ts'
  );
  assert.equal(
    tabsImports.includes('@/domains/settings'),
    false,
    'settings/tabs.ts 不得依赖 settings barrel'
  );

  const registryImports = readImportSpecifiers(settingsRegistry.content);
  assert.equal(
    registryImports.includes('./site-aware'),
    false,
    'settings/registry.ts 不得反向依赖 site-aware'
  );
  assert.equal(
    registryImports.includes('./index'),
    false,
    'settings/registry.ts 不得依赖 settings/index.ts'
  );
});

test('architecture: settings-store 拥有 settings cache invalidation', async () => {
  const files = await readSourceFiles();
  const settingsStore = files.find(
    ({ repoPath }) =>
      repoPath === 'src/domains/settings/application/settings-store.ts'
  );
  const adminSettingsPage = files.find(
    ({ repoPath }) =>
      repoPath === 'src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx'
  );

  assert.ok(settingsStore, 'settings-store.ts 应存在');
  assert.ok(adminSettingsPage, 'admin settings page 应存在');

  assert.equal(
    readImportSpecifiers(settingsStore.content).includes('next/cache'),
    true,
    'settings-store.ts 应直接拥有 next/cache revalidation'
  );
  assert.equal(
    /revalidateTag\s*\(\s*CONFIGS_CACHE_TAG\s*,\s*['"]max['"]\s*\)/.test(
      settingsStore.content
    ),
    true,
    'settings-store.ts 应 invalidates CONFIGS_CACHE_TAG'
  );
  assert.equal(
    /revalidateTag\s*\(\s*PUBLIC_CONFIGS_CACHE_TAG\s*,\s*['"]max['"]\s*\)/.test(
      settingsStore.content
    ),
    true,
    'settings-store.ts 应 invalidates PUBLIC_CONFIGS_CACHE_TAG'
  );
  assert.equal(
    readImportSpecifiers(adminSettingsPage.content).includes('next/cache'),
    false,
    'admin settings page 不应直接依赖 next/cache'
  );
  assert.equal(
    /CONFIGS_CACHE_TAG|PUBLIC_CONFIGS_CACHE_TAG|revalidateTag\s*\(/.test(
      adminSettingsPage.content
    ),
    false,
    'admin settings page 不应拥有 settings cache invalidation'
  );
});

test('architecture: app-only facade 只有两个 runtime-deps 且仅限 app 导入', async () => {
  const files = await readSourceFiles();
  const runtimeFacadeFiles = files.filter(({ repoPath }) =>
    /^src\/app\/.+\/runtime-deps\.ts$/.test(repoPath)
  );

  assert.deepEqual(
    runtimeFacadeFiles.map((file) => file.repoPath).sort(),
    [...ARCHITECTURE_RULES.appOnlyFacades].sort(),
    'runtime-deps 长期边界只能是 account/access-control 两个 app-only facade'
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      if (
        !appOnlyFacadeImportPatterns.some((pattern: RegExp) =>
          pattern.test(specifier)
        )
      ) {
        continue;
      }

      assert.equal(
        /^src\/app\//.test(file.repoPath),
        true,
        `${file.repoPath} 不应导入 app-only facade ${specifier}`
      );
    }
  }
});

test('architecture: 只有 settings domain 和 admin settings 页面可以导入 settings-store / Configs', async () => {
  const files = await readSourceFiles();

  for (const file of files) {
    const importsSettingsStore = readImportSpecifiers(file.content).some(
      (specifier) =>
        specifier === '@/domains/settings/application/settings-store' ||
        specifier === './settings-store'
    );
    const mentionsConfigsImport =
      /import\s+type\s*\{[^}]*\bConfigs\b[^}]*\}\s+from\s+['"][^'"]*settings-store['"]/.test(
        file.content
      );

    if (!importsSettingsStore && !mentionsConfigsImport) {
      continue;
    }

    const allowed =
      /^src\/domains\/settings\//.test(file.repoPath) ||
      file.repoPath ===
        'src/app/[locale]/(admin)/admin/settings/[tab]/page.tsx';

    assert.equal(
      allowed,
      true,
      `${file.repoPath} 不应导入 settings-store / Configs`
    );
  }
});

test('architecture: 跨域 application 依赖只能指向只读入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(/^@\/domains\/([^/]+)\/application\/(.+)$/);
      if (!match) continue;

      const [, targetDomain, targetPath] = match;
      if (targetDomain === source.domain) continue;

      assert.equal(
        queryViewAllowedSameDomainApplicationPathPattern.test(targetPath),
        true,
        `${file.repoPath} 跨域依赖 ${specifier} 必须指向受控只读入口`
      );
    }
  }
});

test('architecture: application 只能使用受控 platform 入口', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      if (!specifier.startsWith('@/infra/platform/')) continue;
      if (isAllowedApplicationPlatformException(file.repoPath, specifier)) {
        continue;
      }

      assert.equal(
        applicationAllowedPlatformImportPatterns.some((pattern: RegExp) =>
          pattern.test(specifier)
        ),
        true,
        `${file.repoPath} 只能导入 logging/request context platform 入口: ${specifier}`
      );
    }
  }
});

test('architecture: application 默认外域 fan-out 不超过预算', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) =>
      /^src\/domains\/[^/]+\/application\//.test(repoPath) &&
      !isTestFile(repoPath) &&
      !isAggregationFile(repoPath) &&
      !isOrchestrationFile(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    const targetDomains = new Set<string>();
    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(/^@\/domains\/([^/]+)\/application\/(.+)$/);
      if (!match) continue;

      const [, targetDomain, targetPath] = match;
      if (targetDomain === source.domain) continue;
      if (!/\.(?:query|view)(?:\.[^/.]+)?$/.test(targetPath)) continue;

      targetDomains.add(targetDomain);
    }

    assert.equal(
      targetDomains.size <= ARCHITECTURE_RULES.applicationFanOutLimit,
      true,
      `${file.repoPath} 外域 application fan-out ${targetDomains.size} 超过预算 ${ARCHITECTURE_RULES.applicationFanOutLimit}`
    );
  }
});

test('architecture: query/view 只做同域读取或投影', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\/.*\.(?:query|view)\.ts$/.test(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const domainAppImport = specifier.match(
        /^@\/domains\/([^/]+)\/application\/(.+)$/
      );
      if (domainAppImport) {
        const [, targetDomain, targetPath] = domainAppImport;
        assert.equal(
          targetDomain,
          source.domain,
          `${file.repoPath} query/view 不应导入外域 application: ${specifier}`
        );
        assert.equal(
          queryViewAllowedSameDomainApplicationPathPattern.test(targetPath),
          true,
          `${file.repoPath} query/view 只能导入 query/view application: ${specifier}`
        );
      }

      assert.equal(
        /^@\/domains\/settings\/application\/settings-store$/.test(specifier),
        false,
        `${file.repoPath} query/view 不应导入 settings-store`
      );
      assert.equal(
        /^@\/infra\/adapters(?:\/|$)/.test(specifier),
        false,
        `${file.repoPath} query/view 不应导入 infra/adapters`
      );
    }
  }
});

test('architecture: aggregation 例外必须显式标注并保持只读', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    isAggregationFile(repoPath)
  );

  assert.equal(
    files.length <= ARCHITECTURE_RULES.aggregation.totalBudget,
    true,
    `aggregation 文件总数 ${files.length} 超过预算 ${ARCHITECTURE_RULES.aggregation.totalBudget}`
  );

  for (const [domain, count] of countByDomain(files)) {
    assert.equal(
      count <= ARCHITECTURE_RULES.aggregation.perDomainBudget,
      true,
      `${domain} aggregation 文件数 ${count} 超过预算 ${ARCHITECTURE_RULES.aggregation.perDomainBudget}`
    );
  }

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);
    assertHasMarker(
      file.content,
      ARCHITECTURE_RULES.aggregation.marker,
      file.repoPath
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.aggregation.reasonPattern,
      file.repoPath,
      '必须写明 reason'
    );

    for (const specifier of readImportSpecifiers(file.content)) {
      const domainAppImport = specifier.match(
        /^@\/domains\/([^/]+)\/application\/(.+)$/
      );
      if (domainAppImport) {
        const [, targetDomain, targetPath] = domainAppImport;
        if (targetDomain === source.domain) continue;
        assert.equal(
          /\.(?:query|view)(?:\.[^/.]+)?$/.test(targetPath),
          true,
          `${file.repoPath} aggregation 只能依赖外域 query/view: ${specifier}`
        );
      }
      assert.equal(
        /\/application\/orchestration\//.test(specifier),
        false,
        `${file.repoPath} aggregation 不应导入 orchestration`
      );
    }
  }
});

test('architecture: orchestration 例外必须显式标注并禁止嵌套', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    isOrchestrationFile(repoPath)
  );

  assert.equal(
    files.length <= ARCHITECTURE_RULES.orchestration.totalBudget,
    true,
    `orchestration 文件总数 ${files.length} 超过预算 ${ARCHITECTURE_RULES.orchestration.totalBudget}`
  );

  for (const [domain, count] of countByDomain(files)) {
    assert.equal(
      count <= ARCHITECTURE_RULES.orchestration.perDomainBudget,
      true,
      `${domain} orchestration 文件数 ${count} 超过预算 ${ARCHITECTURE_RULES.orchestration.perDomainBudget}`
    );
  }

  for (const file of files) {
    assertHasMarker(
      file.content,
      ARCHITECTURE_RULES.orchestration.marker,
      file.repoPath
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.orchestration.reasonPattern,
      file.repoPath,
      '必须写明 reason'
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.orchestration.ownerPattern,
      file.repoPath,
      '必须写明 owner'
    );
    assertHasPattern(
      file.content,
      ARCHITECTURE_RULES.orchestration.failureCompensationPattern,
      file.repoPath,
      '必须写明 failure-compensation'
    );

    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        /\/application\/orchestration\//.test(specifier),
        false,
        `${file.repoPath} orchestration 不应嵌套导入 orchestration`
      );
      assert.equal(
        /^@\/domains\/[^/]+\/(?:infra|repository|provider)(?:\/|$)/.test(
          specifier
        ),
        false,
        `${file.repoPath} orchestration 不应导入外域 infra/repository/provider: ${specifier}`
      );
    }
  }
});

test('architecture: aggregation/orchestration 不能被外域 application 调用', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/domains\/[^/]+\/application\//.test(repoPath)
  );

  for (const file of files) {
    const source = parseDomainApplicationPath(file.repoPath);
    assert.ok(source, `${file.repoPath} 应属于明确的 domain application`);

    for (const specifier of readImportSpecifiers(file.content)) {
      const match = specifier.match(/^@\/domains\/([^/]+)\/application\/(.+)$/);
      if (!match) continue;
      const [, targetDomain, targetPath] = match;
      if (targetDomain === source.domain) continue;

      assert.equal(
        /^(?:aggregation|orchestration)\//.test(targetPath),
        false,
        `${file.repoPath} 不应调用外域 aggregation/orchestration: ${specifier}`
      );
    }
  }
});

test('architecture: 架构门禁配置保持单一事实源', async () => {
  const dependencyCruiserConfigPath = path.resolve(
    repoRoot,
    'dependency-cruiser.cjs'
  );
  const dependencyCruiserSource = await readFile(
    dependencyCruiserConfigPath,
    'utf8'
  );
  const dependencyCruiserConfig = require(dependencyCruiserConfigPath);
  const ruleNames = dependencyCruiserConfig.forbidden.map(
    (rule: { name: string }) => rule.name
  );

  assert.match(
    dependencyCruiserSource,
    /require\(['"]\.\/architecture-rules\.cjs['"]\)/,
    'dependency-cruiser.cjs 必须消费共享 architecture-rules.cjs'
  );
  assert.ok(
    ruleNames.includes('no-circular'),
    'dependency-cruiser.cjs 必须启用 no-circular'
  );
  assert.ok(
    ruleNames.includes('no-admin-app-to-domain-infra-or-adapters'),
    'dependency-cruiser.cjs 必须包含 admin app 入口目录门禁'
  );
  assert.ok(
    ruleNames.includes(
      'no-surfaces-admin-to-app-facades-domain-infra-or-adapters'
    ),
    'dependency-cruiser.cjs 必须包含 surfaces/admin 目录门禁'
  );
});

test('architecture: shared/lib 只保留 allowlist 纯工具', async () => {
  const files = (await readSourceFiles()).filter(({ repoPath }) =>
    /^src\/shared\/lib\//.test(repoPath)
  );

  for (const file of files) {
    const sharedLibPath = file.repoPath.replace(/^src\/shared\/lib\//, '');
    assert.equal(
      sharedLibAllowedPathPatterns.some((pattern: RegExp) =>
        pattern.test(sharedLibPath)
      ),
      true,
      `${file.repoPath} 不在 shared/lib allowlist 中`
    );

    for (const token of ARCHITECTURE_RULES.sharedLibForbiddenSemanticNames) {
      assert.equal(
        new RegExp(`(?:^|/)${token}(?:[./-]|$)`).test(sharedLibPath),
        false,
        `${file.repoPath} 命中业务语义入口名 ${token}`
      );
    }
  }
});

test('architecture: entitlement and remover entitlement paths do not import RBAC or admin bypasses', async () => {
  const files = (await readSourceFiles()).filter(
    ({ repoPath }) =>
      !isTestFile(repoPath) &&
      (/^src\/domains\/entitlements\//.test(repoPath) ||
        /^src\/domains\/remover\/(?:domain|application)\//.test(repoPath))
  );

  for (const file of files) {
    for (const specifier of readImportSpecifiers(file.content)) {
      assert.equal(
        /^@\/(?:domains\/access-control|infra\/adapters\/access-control|surfaces\/admin|app\/[^'"]*admin)/.test(
          specifier
        ),
        false,
        `${file.repoPath} entitlement path must not import RBAC/admin module: ${specifier}`
      );
    }

    assert.equal(
      /\bsuper_admin\b|\bbypassQuota\b|\bskipQuota\b/u.test(file.content),
      false,
      `${file.repoPath} entitlement path must not contain admin/quota bypass tokens`
    );
  }
});

test('architecture: product-access remains remover agnostic', async () => {
  const files = sourceFilesInDomain(await readSourceFiles(), 'product-access');

  for (const file of files) {
    assertNoImporter(
      file,
      /^@\/domains\/remover(?:\/|$)/,
      'must not import AI Remover'
    );
    assert.doesNotMatch(file.content, /\bai-remover\b|remover_/u);
  }
});

test('architecture: product-entitlements does not hard-code AI Remover entitlement keys', async () => {
  const files = sourceFilesInDomain(
    await readSourceFiles(),
    'product-entitlements'
  );
  const aiRemoverEntitlementKeys = [
    'guest_daily_removals',
    'daily_removals',
    'signup_high_res_downloads',
    'monthly_removals',
    'monthly_high_res_downloads',
    'advanced_mode',
    'priority_queue',
  ];
  const forbiddenPattern = new RegExp(
    `\\b(?:ai-remover|${aiRemoverEntitlementKeys.join('|')})\\b`,
    'u'
  );

  for (const file of files) {
    assertNoImporter(
      file,
      /^@\/domains\/remover(?:\/|$)/,
      'must not import AI Remover'
    );
    assert.doesNotMatch(file.content, forbiddenPattern);
  }
});

test('architecture: product-quota stays storage-adapter agnostic', async () => {
  const files = sourceFilesInDomain(await readSourceFiles(), 'product-quota');

  for (const file of files) {
    assertNoImporter(
      file,
      /^@\/domains\/remover(?:\/|$)/,
      'must not import AI Remover'
    );
    assert.doesNotMatch(file.content, /\bremover_quota_reservation\b/u);
  }
});

test('architecture: product-runtime stays separate from product implementations', async () => {
  const files = sourceFilesInDomain(await readSourceFiles(), 'product-runtime');

  for (const file of files) {
    assertNoImporter(
      file,
      /^@\/domains\/remover(?:\/|$)/,
      'must not import AI Remover'
    );
    assert.doesNotMatch(file.content, /\bai-remover\b/u);
  }
});

test('architecture: AI Remover product runtime AI binding is independent from shared AI capability', async () => {
  const siteConfig = JSON.parse(
    await readFile(
      path.resolve(repoRoot, 'sites/ai-remover/site.config.json'),
      'utf8'
    )
  );
  const deploySettings = JSON.parse(
    await readFile(
      path.resolve(repoRoot, 'sites/ai-remover/deploy.settings.json'),
      'utf8'
    )
  );
  const runtimeContractSource = await readFile(
    path.resolve(repoRoot, 'src/domains/remover/domain/runtime-contract.ts'),
    'utf8'
  );

  assert.equal(siteConfig.capabilities.ai, false);
  assert.equal(deploySettings.bindingRequirements.bindings.workersAi, true);
  assert.match(
    runtimeContractSource,
    /requiredBindings:\s*\{[\s\S]*workersAi:\s*true/u
  );
  assert.doesNotMatch(runtimeContractSource, /capabilities\.ai/u);
});
