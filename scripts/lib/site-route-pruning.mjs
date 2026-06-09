import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const FREE_TOOL_ROUTE_PRUNE_PATHS = Object.freeze([
  'src/app/[locale]/(admin)',
  'src/app/[locale]/admin',
  'src/app/[locale]/(auth)',
  'src/app/[locale]/(chat)',
  'src/app/[locale]/(docs)',
  'src/app/[locale]/(landing)/(ai)',
  'src/app/[locale]/(landing)/activity',
  'src/app/[locale]/(landing)/blog',
  'src/app/[locale]/(landing)/my-images',
  'src/app/[locale]/(landing)/pricing',
  'src/app/[locale]/(landing)/settings',
  'src/app/api/ai',
  'src/app/api/auth',
  'src/app/api/background-remover',
  'src/app/api/chat',
  'src/app/api/docs',
  'src/app/api/email',
  'src/app/api/payment',
  'src/app/api/remover',
  'src/app/api/storage',
  'src/app/api/tts',
  'src/app/api/user',
]);
const NEXT_ROUTE_ENTRY_FILENAMES = new Set([
  'default.tsx',
  'error.tsx',
  'forbidden.tsx',
  'global-error.tsx',
  'instrumentation.ts',
  'layout.tsx',
  'loading.tsx',
  'middleware.ts',
  'not-found.tsx',
  'page.tsx',
  'proxy.ts',
  'route.ts',
  'template.tsx',
  'unauthorized.tsx',
]);

function hasHyperdriveBinding(contract) {
  return contract.bindingRequirements?.bindings?.hyperdrive === true;
}

export function isFreeToolBuildContract(contract) {
  const capabilities = contract.site?.capabilities;
  return (
    capabilities?.auth === false &&
    capabilities.payment === 'none' &&
    capabilities.ai === false &&
    capabilities.docs === false &&
    capabilities.blog === false &&
    !hasHyperdriveBinding(contract)
  );
}

export function resolveSiteRoutePrunePaths(contract) {
  if (!isFreeToolBuildContract(contract)) {
    return [];
  }

  return [...FREE_TOOL_ROUTE_PRUNE_PATHS];
}

function encodePrunedPath(relativePath) {
  return relativePath.replaceAll('/', '__');
}

async function collectRouteEntryFiles(rootDir, relativePath) {
  const sourcePath = path.resolve(rootDir, relativePath);
  if (!existsSync(sourcePath)) {
    return [];
  }

  const sourceStats = await stat(sourcePath);
  if (sourceStats.isFile()) {
    return NEXT_ROUTE_ENTRY_FILENAMES.has(path.basename(sourcePath))
      ? [relativePath]
      : [];
  }

  if (!sourceStats.isDirectory()) {
    return [];
  }

  const entries = await readdir(sourcePath, { withFileTypes: true });
  const nestedPaths = await Promise.all(
    entries.map((entry) =>
      collectRouteEntryFiles(rootDir, path.join(relativePath, entry.name))
    )
  );
  return nestedPaths.flat();
}

async function collectSiteRouteEntryFiles(rootDir, prunePaths) {
  const routeFiles = await Promise.all(
    prunePaths.map((relativePath) =>
      collectRouteEntryFiles(rootDir, relativePath)
    )
  );

  return [...new Set(routeFiles.flat())].sort();
}

async function restorePrunedRoutes(entries) {
  for (const entry of [...entries].reverse()) {
    if (!existsSync(entry.prunedPath)) {
      continue;
    }

    await mkdir(path.dirname(entry.sourcePath), { recursive: true });
    await rename(entry.prunedPath, entry.sourcePath);
  }
}

export async function withSiteRoutePruning({
  rootDir = process.cwd(),
  contract,
  logger = console,
  task,
}) {
  const prunePaths = resolveSiteRoutePrunePaths(contract);
  if (prunePaths.length === 0) {
    return task();
  }

  const pruneRoot = path.resolve(
    rootDir,
    '.tmp',
    'site-route-prune',
    `${contract.site.key}-${process.pid}`
  );
  await rm(pruneRoot, { recursive: true, force: true });
  await mkdir(pruneRoot, { recursive: true });

  const entries = [];
  try {
    const routeFiles = await collectSiteRouteEntryFiles(rootDir, prunePaths);
    for (const relativePath of routeFiles) {
      const sourcePath = path.resolve(rootDir, relativePath);
      const prunedPath = path.join(pruneRoot, encodePrunedPath(relativePath));
      await mkdir(path.dirname(prunedPath), { recursive: true });
      await rename(sourcePath, prunedPath);
      entries.push({ relativePath, sourcePath, prunedPath });
    }

    if (entries.length > 0) {
      logger.log(
        `[cf:build] ${contract.site.key}: pruned ${entries.length} disabled route file(s) for free tool build`
      );
    }

    return await task();
  } finally {
    await restorePrunedRoutes(entries);
    await rm(pruneRoot, { recursive: true, force: true });
  }
}
