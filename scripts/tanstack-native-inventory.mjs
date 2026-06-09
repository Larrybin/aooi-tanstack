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

function section(title, items) {
  return [
    `## ${title}`,
    '',
    `Count: ${items.length}`,
    '',
    ...items.map((item) => `- \`${item}\``),
    '',
  ].join('\n');
}

writeFileSync(
  join(docsDir, 'next-route-inventory.md'),
  [
    '# Next Route Inventory',
    '',
    section('Pages', pages),
    section('Layouts', layouts),
    section('Loading Files', loading),
    section('Not Found Files', notFound),
    section('Files with generateMetadata', metadataFiles),
    section('Files with generateStaticParams', staticParamsFiles),
    section('Files with params: Promise', paramsPromiseFiles),
    section('Files with next/* imports', nextImports),
  ].join('\n')
);

writeFileSync(
  join(docsDir, 'api-route-inventory.md'),
  [
    '# API Route Inventory',
    '',
    section('All API route handlers', routes),
    section(
      'Payment / quota / AI / storage write-related route handlers',
      apiWriteFiles
    ),
  ].join('\n')
);

writeFileSync(
  join(docsDir, 'route-map.md'),
  [
    '# TanStack Native Route Map',
    '',
    'Gate 0-3 only creates real TanStack route files for the vertical slice. Unmigrated routes are inventoried here but are intentionally not generated as placeholders.',
    '',
    '| Legacy route | Gate 0-3 TanStack status |',
    '|---|---|',
    '| `src/app/[locale]/(landing)/pricing/page.tsx` | `apps/web/src/routes/$locale/pricing.tsx` |',
    '| `src/app/api/payment/checkout/route.ts` | `apps/web/src/routes/api/payment/checkout.ts` |',
    '| `src/app/api/payment/notify/route.ts` | `apps/web/src/routes/api/payment/notify.ts` |',
    '| `src/app/api/user/get-user-credits/route.ts` | `apps/web/src/routes/api/user/get-user-credits.ts` |',
    '',
    'All other routes remain legacy baseline until Gate 4-7.',
  ].join('\n')
);

writeFileSync(
  join(docsDir, 'gate-0-verification.md'),
  [
    '# Gate 0 Verification',
    '',
    `Generated inventories from \`${relative(root, process.cwd()) || '.'}\`.`,
    '',
    `- Pages: ${pages.length}`,
    `- API routes: ${routes.length}`,
    `- Files with next/* imports: ${nextImports.length}`,
    `- Files with generateMetadata: ${metadataFiles.length}`,
    `- Files with generateStaticParams: ${staticParamsFiles.length}`,
    `- Files with params: Promise: ${paramsPromiseFiles.length}`,
  ].join('\n')
);

console.log('Generated TanStack native migration inventories.');
