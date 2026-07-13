import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  '.git',
  '.turbo',
  '.wrangler',
  'node_modules',
  'dist',
  'build',
  'out',
  '.codex',
]);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function walkFiles(rootDir, startDir) {
  const absStart = path.join(rootDir, startDir);
  if (!fs.existsSync(absStart)) return [];

  /** @type {string[]} */
  const results = [];

  /** @type {string[]} */
  const stack = [absStart];
  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      results.push(toPosix(path.relative(rootDir, abs)));
    }
  }

  return results.sort();
}

function readText(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return '';
  }
}

function containsAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function discover(rootDir) {
  const seoHelper = fs.existsSync(path.join(rootDir, 'src/shared/lib/seo.ts'))
    ? ['src/shared/lib/seo.ts']
    : [];

  const routeFiles = walkFiles(rootDir, 'apps/web/src/routes').filter(
    (p) => p.endsWith('.ts') || p.endsWith('.tsx')
  );
  const routesUsingHead = [];
  for (const rel of routeFiles) {
    const abs = path.join(rootDir, rel);
    const content = readText(abs);
    if (!content) continue;

    if (containsAny(content, ['head: (', 'head:({', 'head: {'])) {
      routesUsingHead.push(rel);
    }
  }

  const routeHandlers = routeFiles.filter((p) =>
    p.startsWith('apps/web/src/routes/api/')
  );

  const paymentProviders = walkFiles(
    rootDir,
    'src/infra/adapters/payment'
  ).filter((p) => p.endsWith('.ts'));

  const singleSources = [
    'docs/CONVENTIONS.md',
    'docs/architecture/shared-layering.md',
    'docs/CODE_REVIEW.md',
    'docs/archive/architecture/ARCHITECTURE_REVIEW.md',
    'sites/<site-key>/content/docs/logging-conventions.zh.mdx',
    'sites/<site-key>/content/docs/code-review-checklist.zh.mdx',
    'eslint.config.mjs',
  ].filter((p) => fs.existsSync(path.join(rootDir, p)));

  return {
    seoHelper,
    routesUsingHead: routesUsingHead.sort(),
    routeHandlers: routeHandlers.sort(),
    paymentProviders: paymentProviders.sort(),
    singleSources,
  };
}

function renderDraft(discovery) {
  const lines = [];
  lines.push('# 既有约定与代码模式索引（Conventions Index）');
  lines.push('');
  lines.push(
    '本文件是索引入口：指向仓库中的“单一事实来源”和同类样本，帮助快速对齐既有约定。'
  );
  lines.push('');
  lines.push('## 单一事实来源（优先查这里）');
  for (const p of discovery.singleSources) {
    lines.push(`- \`${p}\``);
  }

  lines.push('');
  lines.push('## 模式样本索引（草案，需人工 review）');

  lines.push('');
  lines.push('### SEO / Head（TanStack Router）');
  if (discovery.seoHelper.length) {
    lines.push(`- helper：\`${discovery.seoHelper[0]}\``);
  } else {
    lines.push(
      '- helper：未发现 `src/shared/lib/seo.ts`（如存在其它封装，请补充）'
    );
  }

  const headSamples = discovery.routesUsingHead.slice(0, 8);
  if (headSamples.length) {
    lines.push('- 使用 route head 的页面（抽样）：');
    for (const p of headSamples) lines.push(`  - \`${p}\``);
  }

  lines.push('');
  lines.push('### API Routes（apps/web/src/routes/api/**）');
  const routeSamples = discovery.routeHandlers.slice(0, 10);
  if (routeSamples.length) {
    for (const p of routeSamples) lines.push(`- \`${p}\``);
    if (discovery.routeHandlers.length > routeSamples.length) {
      lines.push(`- ...（共 ${discovery.routeHandlers.length} 个）`);
    }
  } else {
    lines.push('- 未发现 route handlers');
  }

  lines.push('');
  lines.push('### 支付集成（infra/adapters/payment）');
  const paymentSamples = discovery.paymentProviders.slice(0, 10);
  if (paymentSamples.length) {
    for (const p of paymentSamples) lines.push(`- \`${p}\``);
    if (discovery.paymentProviders.length > paymentSamples.length) {
      lines.push(`- ...（共 ${discovery.paymentProviders.length} 个）`);
    }
  } else {
    lines.push('- 未发现 payment providers');
  }

  lines.push('');
  lines.push('## 说明');
  lines.push(
    '- 本草案用于“生成初稿 + 人工 review 合入”。请将缺失的主题与关键样本补齐到 `docs/CONVENTIONS.md`。'
  );
  lines.push(
    '- 如需 CI 校验，可在 CI 中运行 `node scripts/conventions-index.mjs --check`。'
  );

  return `${lines.join('\n')}\n`;
}

function extractPathsFromDoc(docText) {
  /** @type {Set<string>} */
  const paths = new Set();
  const backtickMatches = docText.matchAll(/`([^`\n]+)`/g);
  for (const match of backtickMatches) {
    const value = (match[1] || '').trim();
    if (!value) continue;
    if (value.includes(' ')) continue;
    if (value.startsWith('http://') || value.startsWith('https://')) continue;
    if (!value.includes('/')) continue;
    if (value.includes('<') || value.includes('>')) continue; // placeholders
    if (value.includes('*')) continue; // skip globs
    if (value.endsWith('/')) continue;

    // 仅校验仓库内真实路径；`.codex/**` 为本地产物不校验。
    if (value.startsWith('.codex/')) continue;
    if (
      !(
        value.startsWith('docs/') ||
        value.startsWith('src/') ||
        value.startsWith('sites/') ||
        value.startsWith('scripts/') ||
        value.startsWith('prompts/')
      )
    ) {
      continue;
    }

    paths.add(value);
  }
  return Array.from(paths).sort();
}

function validateConventions(rootDir, discovery) {
  const conventionsPath = path.join(rootDir, 'docs/CONVENTIONS.md');
  if (!fs.existsSync(conventionsPath)) {
    return { ok: false, errors: ['缺少 docs/CONVENTIONS.md'], warnings: [] };
  }

  const docText = readText(conventionsPath);
  const referencedPaths = extractPathsFromDoc(docText);

  /** @type {string[]} */
  const errors = [];
  for (const rel of referencedPaths) {
    const abs = path.join(rootDir, rel);
    if (!fs.existsSync(abs)) {
      errors.push(`引用路径不存在：${rel}`);
    }
  }

  /** @type {string[]} */
  const warnings = [];
  const suggestSamples = [
    ...discovery.seoHelper,
    ...discovery.routesUsingHead.slice(0, 5),
    ...discovery.routeHandlers.slice(0, 5),
  ];
  for (const rel of suggestSamples) {
    if (!docText.includes(rel)) {
      warnings.push(`发现样本未收录（可选）：${rel}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function parseArgs(argv) {
  const args = { root: '.', out: '', check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--root') args.root = argv[i + 1] || '.';
    if (value === '--out') args.out = argv[i + 1] || '';
    if (value === '--check') args.check = true;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), args.root);
  const discovery = discover(rootDir);

  if (args.check) {
    const report = validateConventions(rootDir, discovery);
    for (const w of report.warnings) console.warn(`[warn] ${w}`);
    for (const e of report.errors) console.error(`[error] ${e}`);
    if (!report.ok) process.exit(1);
    console.log('OK: docs/CONVENTIONS.md 校验通过');
    return;
  }

  const outRel = args.out || '.codex/drafts/CONVENTIONS.generated.md';
  const outAbs = path.isAbsolute(outRel) ? outRel : path.join(rootDir, outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, renderDraft(discovery), 'utf8');
  console.log(toPosix(path.relative(rootDir, outAbs)));
}

main();
