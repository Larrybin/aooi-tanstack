import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
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
  'src/app/api/config',
  'src/app/api/docs',
  'src/app/api/email',
  'src/app/api/payment',
  'src/app/api/remover',
  'src/app/api/storage',
  'src/app/api/tts',
  'src/app/api/user',
  'apps/web/src/routes/admin_.tsx',
  'apps/web/src/routes/admin',
  'apps/web/src/routes/$locale/admin_.tsx',
  'apps/web/src/routes/$locale/admin',
  'apps/web/src/routes/sign-in.tsx',
  'apps/web/src/routes/sign-up.tsx',
  'apps/web/src/routes/forgot-password.tsx',
  'apps/web/src/routes/reset-password.tsx',
  'apps/web/src/routes/no-permission.tsx',
  'apps/web/src/routes/$locale/sign-in.tsx',
  'apps/web/src/routes/$locale/sign-up.tsx',
  'apps/web/src/routes/$locale/forgot-password.tsx',
  'apps/web/src/routes/$locale/reset-password.tsx',
  'apps/web/src/routes/$locale/no-permission.tsx',
  'apps/web/src/routes/chat_.tsx',
  'apps/web/src/routes/chat',
  'apps/web/src/routes/$locale/chat_.tsx',
  'apps/web/src/routes/$locale/chat',
  'apps/web/src/routes/docs_.tsx',
  'apps/web/src/routes/docs',
  'apps/web/src/routes/$locale/docs_.tsx',
  'apps/web/src/routes/$locale/docs',
  'apps/web/src/routes/ai-chatbot.tsx',
  'apps/web/src/routes/ai-image-generator.tsx',
  'apps/web/src/routes/ai-music-generator.tsx',
  'apps/web/src/routes/$locale/ai-chatbot.tsx',
  'apps/web/src/routes/$locale/ai-image-generator.tsx',
  'apps/web/src/routes/$locale/ai-music-generator.tsx',
  'apps/web/src/routes/activity_.tsx',
  'apps/web/src/routes/activity',
  'apps/web/src/routes/$locale/activity_.tsx',
  'apps/web/src/routes/$locale/activity',
  'apps/web/src/routes/blog_.tsx',
  'apps/web/src/routes/blog',
  'apps/web/src/routes/$locale/blog_.tsx',
  'apps/web/src/routes/$locale/blog',
  'apps/web/src/routes/my-images.tsx',
  'apps/web/src/routes/$locale/my-images.tsx',
  'apps/web/src/routes/pricing.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/settings_.tsx',
  'apps/web/src/routes/settings',
  'apps/web/src/routes/$locale/settings_.tsx',
  'apps/web/src/routes/$locale/settings',
  'apps/web/src/routes/api/ai',
  'apps/web/src/routes/api/auth.ts',
  'apps/web/src/routes/api/auth',
  'apps/web/src/routes/api/background-remover',
  'apps/web/src/routes/api/chat.ts',
  'apps/web/src/routes/api/chat',
  'apps/web/src/routes/api/config',
  'apps/web/src/routes/api/docs',
  'apps/web/src/routes/api/email',
  'apps/web/src/routes/api/payment',
  'apps/web/src/routes/api/remover',
  'apps/web/src/routes/api/storage',
  'apps/web/src/routes/api/tts',
  'apps/web/src/routes/api/user',
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
const TANSTACK_ROUTE_EXTENSIONS = new Set(['.ts', '.tsx']);
const GENERATED_ROUTE_FILES = Object.freeze(['apps/web/src/routeTree.gen.ts']);

function isRouteEntryFile(relativePath) {
  if (relativePath.startsWith('src/app/')) {
    return NEXT_ROUTE_ENTRY_FILENAMES.has(path.basename(relativePath));
  }

  if (relativePath.startsWith('apps/web/src/routes/')) {
    return TANSTACK_ROUTE_EXTENSIONS.has(path.extname(relativePath));
  }

  return false;
}

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
    return isRouteEntryFile(relativePath) ? [relativePath] : [];
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

async function backupGeneratedRouteFiles(rootDir, pruneRoot) {
  const backups = [];
  for (const relativePath of GENERATED_ROUTE_FILES) {
    const sourcePath = path.resolve(rootDir, relativePath);
    const backupPath = path.join(pruneRoot, encodePrunedPath(relativePath));
    const existed = existsSync(sourcePath);

    if (existed) {
      await mkdir(path.dirname(backupPath), { recursive: true });
      await copyFile(sourcePath, backupPath);
    }

    backups.push({ sourcePath, backupPath, existed });
  }

  return backups;
}

async function restoreGeneratedRouteFiles(backups) {
  for (const backup of backups) {
    if (!backup.existed) {
      await rm(backup.sourcePath, { force: true });
      continue;
    }

    await mkdir(path.dirname(backup.sourcePath), { recursive: true });
    await copyFile(backup.backupPath, backup.sourcePath);
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
  const generatedRouteBackups = await backupGeneratedRouteFiles(
    rootDir,
    pruneRoot
  );
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
    await restoreGeneratedRouteFiles(generatedRouteBackups);
    await rm(pruneRoot, { recursive: true, force: true });
  }
}
