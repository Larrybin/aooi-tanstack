#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const outPath = join(root, 'docs/migration/gate-4-page-migration-plan.generated.md');
const checkMode = process.argv.includes('--check');

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.git', '.next', '.open-next', 'dist', 'out'].includes(entry)) continue;
    const abs = join(dir, entry);
    const stats = statSync(abs);
    if (stats.isDirectory()) walk(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function read(abs) {
  return readFileSync(abs, 'utf8');
}

function rel(abs) {
  return relative(root, abs).split('\\').join('/');
}

function md(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '<br>');
}

function stripRouteGroups(parts) {
  return parts.filter((part) => !(part.startsWith('(') && part.endsWith(')')));
}

function nextSegmentToUrl(segment) {
  if (segment === '[locale]') return '$locale';
  if (/^\[\.\.\.(.+)\]$/.test(segment)) return `$${segment.match(/^\[\.\.\.(.+)\]$/)[1]}`;
  if (/^\[\[\.\.\.(.+)\]\]$/.test(segment)) return `$${segment.match(/^\[\[\.\.\.(.+)\]\]$/)[1]}?`;
  if (/^\[(.+)\]$/.test(segment)) return `$${segment.slice(1, -1)}`;
  return segment;
}

function nextPathParts(source, type) {
  let path = source.replace(/^src\/app\//, '');
  if (type === 'page') path = path.replace(/\/page\.tsx$/, '');
  if (type === 'layout') path = path.replace(/\/layout\.tsx$/, '');
  if (type === 'not-found') path = path.replace(/not-found\.tsx$/, 'not-found');
  if (path === 'layout.tsx') path = '';
  return stripRouteGroups(path.split('/').filter(Boolean));
}

function publicRoute(source, type) {
  if (type === 'not-found') return 'not-found';
  const parts = nextPathParts(source, type);
  if (type === 'layout') {
    if (!parts.length) return '/';
    return `/${parts.map(nextSegmentToUrl).join('/')}`;
  }
  const routeParts = parts.map(nextSegmentToUrl);
  return routeParts.length ? `/${routeParts.join('/')}` : '/';
}

function routeFileFromPublicRoute(route, type) {
  if (type === 'not-found') return 'apps/web/src/routes/__root.tsx::notFoundComponent';
  if (type === 'layout') {
    if (route === '/') return 'apps/web/src/routes/__root.tsx';
    return `apps/web/src/routes${route}.tsx (layout route or shared shell)`;
  }
  if (route === '/') return 'apps/web/src/routes/index.tsx';
  const filePath = route
    .replace(/\$locale/g, '$locale')
    .replace(/\$([A-Za-z0-9_-]+)\?/g, '$$$1-optional')
    .replace(/\$([A-Za-z0-9_-]+)/g, '$$$1');
  return `apps/web/src/routes${filePath}.tsx`;
}

function pageKeyFromRoute(route, type) {
  if (type === 'not-found') return 'not-found';
  const clean = route
    .replace(/^\//, '')
    .replace(/\$locale\/?/, '')
    .replace(/\$([A-Za-z0-9_-]+)\??/g, '$1')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'home';
}

function surfaceArea(route, source) {
  if (source.includes('/(admin)/') || route.includes('/admin')) return 'admin';
  if (source.includes('/(auth)/') || /\/(sign-in|sign-up|forgot-password|reset-password|no-permission)\b/.test(route)) return 'auth';
  if (source.includes('/(chat)/') || route.includes('/chat')) return 'chat';
  if (source.includes('/(docs)/') || route.includes('/docs')) return 'content';
  if (source.includes('/blog/') || route.includes('/blog')) return 'content';
  if (source.includes('/(landing)/(ai)/') || /\/ai-(image|music|video|audio|chatbot)/.test(route)) return 'ai';
  if (route.includes('/settings') || route.includes('/activity') || route.includes('/my-images')) return 'member';
  if (route === 'not-found') return 'system';
  return 'landing';
}

function helperTargets(route, source, type) {
  const area = surfaceArea(route, source);
  const key = pageKeyFromRoute(route, type);
  const base = `src/surfaces/${area}/${key}`;
  if (type === 'layout') {
    return {
      data: 'n/a',
      seo: 'n/a',
      view: `${base}/${key}.layout.tsx`,
      types: `${base}/${key}.types.ts`,
    };
  }
  if (type === 'not-found') {
    return {
      data: `${base}/${key}.data.ts`,
      seo: `${base}/${key}.seo.ts`,
      view: `${base}/${key}.view.tsx`,
      types: `${base}/${key}.types.ts`,
    };
  }
  return {
    data: `${base}/${key}.data.ts`,
    seo: `${base}/${key}.seo.ts`,
    view: `${base}/${key}.view.tsx`,
    types: `${base}/${key}.types.ts`,
  };
}

function has(source, regex) {
  return regex.test(source);
}

function flagsFor(sourceText, sourcePath, type, route) {
  const tags = new Set();
  if (has(sourceText, /generateMetadata/)) tags.add('generateMetadata');
  if (has(sourceText, /generateStaticParams/)) tags.add('generateStaticParams');
  if (has(sourceText, /params\s*:\s*Promise/)) tags.add('params-promise');
  if (has(sourceText, /from\s+['"]next\//)) tags.add('next-runtime');
  if (has(sourceText, /next-intl\/server/)) tags.add('next-intl');
  if (has(sourceText, /notFound\(/) || sourcePath.includes('not-found')) tags.add('not-found');
  if (has(sourceText, /redirect\(/)) tags.add('redirect');
  if (sourcePath.includes('/(admin)/') || route.includes('/admin')) tags.add('admin');
  if (has(sourceText, /permission|rbac|role/i) || route.includes('/admin/roles') || route.includes('/admin/permissions')) tags.add('rbac');
  if (sourcePath.includes('/(auth)/') || /sign-in|sign-up|forgot-password|reset-password/.test(route)) tags.add('auth');
  if (route.includes('/settings') || route.includes('/activity') || route.includes('/my-images')) tags.add('member');
  if (/\$(?!locale\b)[A-Za-z0-9_-]+\??/.test(route)) tags.add('dynamic-slug');
  if (route.includes('$locale')) tags.add('locale');
  if (has(sourceText, /fetch\(|POST|PUT|PATCH|DELETE|mutation|action\(/i)) tags.add('api-mutation');
  if (has(sourceText, /getTranslations|getScopedMessages|messages|locale/i)) tags.add('i18n');
  if (has(sourceText, /canonical|metadata|openGraph|twitter|hreflang|alternates/i)) tags.add('seo');
  if (sourcePath.includes('/blog') || sourcePath.includes('/docs') || has(sourceText, /source|content|mdx|fumadocs|blog/i)) tags.add('content-loader');
  if (sourcePath.includes('/chat') || has(sourceText, /stream|chat/i)) tags.add('chat');
  if (/ai-|ai\//.test(sourcePath) || /ai-|ai\//.test(route)) tags.add('ai');
  if (has(sourceText, /storage|image|asset|upload|download|R2|file/i)) tags.add('storage');
  if (type === 'layout') tags.add('layout');
  return [...tags].sort();
}

function classify(source, type, route, tags) {
  let primaryBatch = '4-D';
  let sequence = '4-D-4';
  let deferTo = '';
  let risk = 'Medium';
  const blockingTags = new Set();

  if (type === 'not-found') {
    primaryBatch = '4-A'; sequence = '4-A-1'; risk = 'Low';
  } else if (tags.includes('admin') || source.includes('/(admin)/') || route.includes('/admin')) {
    primaryBatch = '4-C'; risk = 'High'; blockingTags.add('admin'); blockingTags.add('rbac');
    if (route === '/$locale/admin' || route === '/$locale/admin/no-permission') sequence = '4-C-1';
    else if (route.includes('/admin/settings')) sequence = '4-C-2';
    else if (/add|edit|delete|restore|replay/.test(route)) sequence = '4-C-4';
    else sequence = '4-C-3';
  } else if (tags.includes('auth') || tags.includes('member') || source.includes('/(auth)/') || source.includes('/settings/') || source.includes('/activity/')) {
    primaryBatch = '4-B'; risk = 'High';
    if (tags.includes('auth')) { sequence = '4-B-1'; blockingTags.add('auth'); }
    else if (route === '/$locale/settings' || route === '/$locale/activity') { sequence = '4-B-2'; blockingTags.add('member'); }
    else if (route.includes('/settings')) { sequence = '4-B-3'; blockingTags.add('member'); }
    else { sequence = '4-B-4'; blockingTags.add('member'); }
    if (route.includes('/my-images')) { blockingTags.add('storage'); }
  } else if (route.includes('/blog') || source.includes('/blog/')) {
    primaryBatch = '4-D'; sequence = '4-D-1'; risk = 'Medium'; blockingTags.add('content-loader');
  } else if (route.includes('/docs') || source.includes('/(docs)/')) {
    primaryBatch = '4-D'; sequence = '4-D-2'; risk = 'Critical'; blockingTags.add('content-loader');
  } else if (route.includes('/chat') || source.includes('/(chat)/') || tags.includes('chat')) {
    primaryBatch = '4-D'; sequence = '4-D-3'; risk = 'Critical'; blockingTags.add('chat');
  } else if (tags.includes('ai') || source.includes('/(ai)/')) {
    primaryBatch = '4-D'; sequence = '4-D-4'; risk = 'Critical'; blockingTags.add('ai'); blockingTags.add('api-read');
  } else {
    primaryBatch = '4-A'; risk = tags.includes('dynamic-slug') ? 'Medium' : 'Low';
    if (route === '/' || route === '/pricing' || route === 'not-found') sequence = '4-A-1';
    else if (route === '/$locale') sequence = '4-A-2';
    else if (route === '/$locale/pricing') sequence = '4-A-3';
    else if (route === '/$locale/$slug') sequence = '4-A-4';
    else sequence = '4-A-4';
  }

  if (tags.includes('api-mutation')) blockingTags.add('api-mutation');
  if (tags.includes('content-loader')) blockingTags.add('content-loader');
  if (tags.includes('streaming')) blockingTags.add('streaming');

  if (primaryBatch === '4-A' && (blockingTags.has('auth') || blockingTags.has('api-mutation') || blockingTags.has('storage'))) {
    deferTo = '4-B if blocking dependency is confirmed';
  }

  return { primaryBatch, sequence, risk, blockingTags: [...blockingTags].sort(), deferTo };
}

function rowForFile(abs) {
  const source = rel(abs);
  const basename = source.split('/').pop();
  const type = basename === 'page.tsx' ? 'page' : basename === 'layout.tsx' ? 'layout' : 'not-found';
  const sourceText = read(abs);
  const route = publicRoute(source, type);
  const tags = flagsFor(sourceText, source, type, route);
  const cls = classify(source, type, route, tags);
  const helpers = helperTargets(route, source, type);
  return {
    type,
    source,
    publicRoute: route,
    targetRoute: routeFileFromPublicRoute(route, type),
    dataHelper: helpers.data,
    seoHelper: helpers.seo,
    viewHelper: helpers.view,
    typesHelper: helpers.types,
    tags,
    ...cls,
    hasGenerateMetadata: tags.includes('generateMetadata') ? 'yes' : 'no',
    hasGenerateStaticParams: tags.includes('generateStaticParams') ? 'yes' : 'no',
    hasParamsPromise: tags.includes('params-promise') ? 'yes' : 'no',
    hasNextRuntime: tags.includes('next-runtime') ? 'yes' : 'no',
    hasNextIntl: tags.includes('next-intl') ? 'yes' : 'no',
  };
}

function renderTable(rows) {
  const headers = [
    'Seq', 'Batch', 'Risk', 'Type', 'Source', 'Public URL', 'TanStack target', 'Data helper', 'SEO helper', 'View/Layout helper', 'Tags', 'Blocking tags', 'Defer', 'metadata', 'staticParams', 'paramsPromise', 'next/*', 'next-intl'
  ];
  const lines = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const r of rows) {
    lines.push(`| ${[
      r.sequence,
      r.primaryBatch,
      r.risk,
      r.type,
      r.source,
      r.publicRoute,
      r.targetRoute,
      r.dataHelper,
      r.seoHelper,
      r.viewHelper,
      r.tags.join(', '),
      r.blockingTags.join(', '),
      r.deferTo,
      r.hasGenerateMetadata,
      r.hasGenerateStaticParams,
      r.hasParamsPromise,
      r.hasNextRuntime,
      r.hasNextIntl,
    ].map(md).join(' | ')} |`);
  }
  return lines.join('\n');
}

function generate() {
  const appDir = join(root, 'src/app');
  const files = walk(appDir)
    .filter((file) => /(?:^|\/)(page|layout|not-found)\.tsx$/.test(file))
    .sort((a, b) => rel(a).localeCompare(rel(b)));
  const rows = files.map(rowForFile);
  const counts = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.type] = (acc[row.type] || 0) + 1;
    acc[row.primaryBatch] = (acc[row.primaryBatch] || 0) + 1;
    acc[row.risk] = (acc[row.risk] || 0) + 1;
    return acc;
  }, { total: 0 });

  return `<!-- AUTO-GENERATED by scripts/tanstack-gate-4-plan.mjs. DO NOT EDIT. -->

# Gate 4 Page Migration Matrix Generated

Generated from \`src/app\` page/layout/not-found files.

## Summary

| Metric | Count |
| --- | ---: |
| Total entries | ${counts.total} |
| Pages | ${counts.page || 0} |
| Layouts | ${counts.layout || 0} |
| Not found | ${counts['not-found'] || 0} |
| Gate 4-A | ${counts['4-A'] || 0} |
| Gate 4-B | ${counts['4-B'] || 0} |
| Gate 4-C | ${counts['4-C'] || 0} |
| Gate 4-D | ${counts['4-D'] || 0} |
| Low risk | ${counts.Low || 0} |
| Medium risk | ${counts.Medium || 0} |
| High risk | ${counts.High || 0} |
| Critical risk | ${counts.Critical || 0} |

## Matrix

${renderTable(rows)}
`;
}

const generated = generate();
if (checkMode) {
  if (!existsSync(outPath)) {
    console.error(`Missing generated plan: ${relative(root, outPath)}`);
    process.exit(1);
  }
  const current = readFileSync(outPath, 'utf8');
  if (current !== generated) {
    console.error(`${relative(root, outPath)} is stale. Run: node scripts/tanstack-gate-4-plan.mjs`);
    process.exit(1);
  }
  console.log('Gate 4 generated page migration plan is fresh.');
} else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, generated);
  console.log(`Generated ${relative(root, outPath)}`);
}
