import fs from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import openNextConfigModule from '../open-next.config.ts';

const openNextConfig =
  openNextConfigModule &&
  typeof openNextConfigModule === 'object' &&
  'buildOpenNextConfig' in openNextConfigModule &&
  'default' in openNextConfigModule
    ? openNextConfigModule.default
    : openNextConfigModule;

const CLOUDFLARE_UNMINIFIED_HANDLER_TARGETS = [
  'default',
  ...Object.keys(openNextConfig.functions ?? {}),
];

const rootDir = process.cwd();
const cloudflarePackageDir = fs.realpathSync(
  path.join(rootDir, 'node_modules', '@opennextjs', 'cloudflare')
);
const cloudflareScopedDir = path.dirname(cloudflarePackageDir);
const cloudflareDistDir = path.join(cloudflarePackageDir, 'dist');
const awsHelperModule = await import(
  pathToFileURL(
    path.join(cloudflareScopedDir, 'aws', 'dist', 'build', 'helper.js')
  ).href
);
const cloudflareBundleModule = await import(
  pathToFileURL(
    path.join(cloudflarePackageDir, 'dist', 'cli', 'build', 'bundle-server.js')
  ).href
);
const { getPackagePath, normalizeOptions } = awsHelperModule;
const { bundleServer } = cloudflareBundleModule;
const baseBuildOptions = normalizeOptions(
  openNextConfig,
  cloudflareDistDir,
  path.join(rootDir, '.open-next', '.build-temp')
);
const packagePath = getPackagePath(baseBuildOptions);
const actualOutputDir = baseBuildOptions.outputDir;
const splitHandlerBundleOptions = {
  // Minifying split handlers causes Radix/Floating UI middleware objects to be
  // emitted with duplicate `options` keys, which Wrangler/esbuild warns about
  // for every local worker boot. Keeping these bundles unminified avoids the
  // warning without changing runtime behavior.
  minify: false,
};

function log(message) {
  console.log(`[cf:bundle] ${message}`);
}

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing ${path.relative(rootDir, filePath)}`);
  }
}

function resolveTargetDir(outputDir, target) {
  return path.join(outputDir, 'server-functions', target);
}

function resolveTargetPackageDir(outputDir, target) {
  return path.join(resolveTargetDir(outputDir, target), packagePath);
}

function patchSplitHandlerRuntime(handlerPath) {
  const source = fs.readFileSync(handlerPath, 'utf8');
  const patched = source
    .replaceAll('require.resolve("./cache.cjs")', '"./cache.cjs"')
    .replaceAll(
      'require.resolve("./composable-cache.cjs")',
      '"./composable-cache.cjs"'
    );

  if (patched !== source) {
    fs.writeFileSync(handlerPath, patched, 'utf8');
  }
}

async function copyIfPresent(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  await cp(sourcePath, targetPath, { recursive: true, force: true });
}

async function bundleSplitTarget(target) {
  const sourceTargetDir = resolveTargetDir(actualOutputDir, target);
  const sourcePackageDir = resolveTargetPackageDir(actualOutputDir, target);
  const sourceIndexPath = path.join(sourcePackageDir, 'index.mjs');

  assertExists(sourceTargetDir);
  assertExists(sourceIndexPath);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), `cf-split-${target}-`));
  const tempOutputDir = path.join(tempDir, '.open-next');
  const tempDefaultDir = resolveTargetDir(tempOutputDir, 'default');
  const tempDefaultPackageDir = resolveTargetPackageDir(
    tempOutputDir,
    'default'
  );

  try {
    await cp(sourceTargetDir, tempDefaultDir, {
      recursive: true,
      force: true,
    });
    await copyIfPresent(
      path.join(actualOutputDir, 'cloudflare-templates'),
      path.join(tempOutputDir, 'cloudflare-templates')
    );

    const buildOptions = {
      ...baseBuildOptions,
      outputDir: tempOutputDir,
      buildDir: path.join(tempOutputDir, '.build'),
    };

    log(`bundling split handler for ${target}`);
    await bundleServer(buildOptions, splitHandlerBundleOptions);

    const bundledHandlerPath = path.join(tempDefaultPackageDir, 'handler.mjs');
    const bundledMetaPath = `${bundledHandlerPath}.meta.json`;

    assertExists(bundledHandlerPath);

    await cp(bundledHandlerPath, path.join(sourcePackageDir, 'handler.mjs'), {
      force: true,
    });
    patchSplitHandlerRuntime(path.join(sourcePackageDir, 'handler.mjs'));

    if (fs.existsSync(bundledMetaPath)) {
      await cp(
        bundledMetaPath,
        path.join(sourcePackageDir, 'handler.mjs.meta.json'),
        { force: true }
      );
    }

    if (packagePath) {
      const rootHandlerPath = path.join(tempDefaultDir, 'handler.mjs');
      if (fs.existsSync(rootHandlerPath)) {
        await cp(rootHandlerPath, path.join(sourceTargetDir, 'handler.mjs'), {
          force: true,
        });
        patchSplitHandlerRuntime(path.join(sourceTargetDir, 'handler.mjs'));
      }
    }

    const handlerSize = fs.statSync(
      path.join(sourcePackageDir, 'handler.mjs')
    ).size;
    log(
      `${target} handler ready: ${handlerSize} bytes (${(handlerSize / 1024 / 1024).toFixed(2)} MiB)`
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  for (const target of CLOUDFLARE_UNMINIFIED_HANDLER_TARGETS) {
    await bundleSplitTarget(target);
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack || error.message : String(error)
  );
  process.exit(1);
});
