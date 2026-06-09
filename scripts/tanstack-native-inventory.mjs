import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const docsDir = join(root, 'docs/migration');
mkdirSync(docsDir, { recursive: true });

function walk(dir, predicate = () => true, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (
      ['node_modules', '.git', '.next', '.open-next', 'dist', 'out'].includes(
        entry
      )
    ) {
      continue;
    }
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path, predicate, acc);
    } else if (predicate(path)) {
      acc.push(relative(root, path));
    }
  }
  return acc.sort();
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function writeDoc(path, lines) {
  writeFileSync(join(docsDir, path), `${lines.join('\n').trimEnd()}\n`);
}

const appDir = join(root, 'src/app');
const allAppFiles = statSync(appDir, { throwIfNoEntry: false })
  ? walk(appDir, (path) => /\.(ts|tsx)$/.test(path))
  : [];

const pages = allAppFiles.filter((file) => /(^|\/)page\.tsx$/.test(file));
const layouts = allAppFiles.filter((file) => /(^|\/)layout\.tsx$/.test(file));
const loading = allAppFiles.filter((file) => /(^|\/)loading\.tsx$/.test(file));
const notFound = allAppFiles.filter((file) =>
  /(^|\/)not-found\.tsx$/.test(file)
);
const routes = allAppFiles.filter((file) => /(^|\/)route\.ts$/.test(file));

function grepFiles(pattern) {
  return allAppFiles.filter((file) => pattern.test(read(file))).sort();
}

const nextImports = grepFiles(/from ['"]next\//);
const metadataFiles = grepFiles(/generateMetadata/);
const staticParamsFiles = grepFiles(/generateStaticParams/);
const paramsPromiseFiles = grepFiles(/params\s*:\s*Promise/);
const apiWriteFiles = routes.filter((file) =>
  /(payment|quota|entitlement|ai|storage|remover|tts|upload|credits)/.test(file)
);
const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts || {};
const buildTestCloudflareCommands = Object.keys(scripts)
  .filter((name) =>
    /^(build|check|ci|test|cf:|contract:check|tanstack:)/.test(name)
  )
  .sort()
  .map((name) => ({ name, command: scripts[name] }));

function section(title, items) {
  const lines = [`## ${title}`, '', `Count: ${items.length}`, ''];
  if (items.length > 0) {
    lines.push(...items.map((item) => `- \`${item}\``), '');
  }
  return lines.join('\n');
}

function markdownTable(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length))
  );

  const renderRow = (row) =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;

  return [
    renderRow(headers),
    renderRow(widths.map((width) => '-'.repeat(width))),
    ...rows.map(renderRow),
  ];
}

writeDoc('next-route-inventory.md', [
  '# Next Route Inventory',
  '',
  section('Pages', pages),
  section('Layouts', layouts),
  section('Loading Files', loading),
  section('Not Found Files', notFound),
  section('Files with generateMetadata', metadataFiles),
  section('Files with generateStaticParams', staticParamsFiles),
  section('Files with params: Promise', paramsPromiseFiles),
  section('Files with next/\\* imports', nextImports),
]);

writeDoc('api-route-inventory.md', [
  '# API Route Inventory',
  '',
  section('All API route handlers', routes),
  section(
    'Payment / quota / AI / storage write-related route handlers',
    apiWriteFiles
  ),
]);

writeDoc('route-map.md', [
  '# TanStack Native Route Map',
  '',
  'Gate 0-3 only creates real TanStack route files for the vertical slice. Unmigrated routes are inventoried here but are intentionally not generated as placeholders.',
  '',
  ...markdownTable(
    ['Legacy route', 'Gate 0-3 TanStack status'],
    [
      [
        '`src/app/[locale]/(landing)/pricing/page.tsx`',
        '`apps/web/src/routes/$locale/pricing.tsx`',
      ],
      [
        '`src/app/api/payment/checkout/route.ts`',
        '`apps/web/src/routes/api/payment/checkout.ts`',
      ],
      [
        '`src/app/api/payment/notify/route.ts`',
        '`apps/web/src/routes/api/payment/notify.ts`',
      ],
      [
        '`src/app/api/user/get-user-credits/route.ts`',
        '`apps/web/src/routes/api/user/get-user-credits.ts`',
      ],
    ]
  ),
  '',
  'All other routes remain legacy baseline until Gate 4-7.',
]);

writeDoc('build-command-inventory.md', [
  '# Build, Test, and Cloudflare Command Inventory',
  '',
  'Generated from `package.json` scripts for the TanStack native migration gates.',
  '',
  ...markdownTable(
    ['Script', 'Command'],
    buildTestCloudflareCommands.map(({ name, command }) => [
      `\`${name}\``,
      `\`${command}\``,
    ])
  ),
  '',
]);

writeDoc('gate-0-verification.md', [
  '# Gate 0 Verification',
  '',
  `Generated inventories from \`${relative(root, process.cwd()) || '.'}\`.`,
  '',
  `- Pages: ${pages.length}`,
  `- API routes: ${routes.length}`,
  `- Files with next/\\* imports: ${nextImports.length}`,
  `- Files with generateMetadata: ${metadataFiles.length}`,
  `- Files with generateStaticParams: ${staticParamsFiles.length}`,
  `- Files with params: Promise: ${paramsPromiseFiles.length}`,
  `- Build/test/Cloudflare command scripts: ${buildTestCloudflareCommands.length}`,
]);

console.log('Generated TanStack native migration inventories.');
