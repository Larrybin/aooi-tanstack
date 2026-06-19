import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  resolveSiteRoutePrunePaths,
  withSiteRoutePruning,
} from './lib/site-route-pruning.mjs';

const freeToolContract = {
  site: {
    key: 'mp4-compressor',
    capabilities: {
      auth: false,
      payment: 'none',
      ai: false,
      docs: false,
      blog: false,
    },
  },
  bindingRequirements: {
    bindings: {
      hyperdrive: false,
    },
  },
};

test('free-tool route pruning includes native TanStack routes', () => {
  const prunePaths = resolveSiteRoutePrunePaths(freeToolContract);

  assert.ok(prunePaths.includes('apps/web/src/routes/sign-in.tsx'));
  assert.ok(prunePaths.includes('apps/web/src/routes/admin_.tsx'));
  assert.ok(prunePaths.includes('apps/web/src/routes/ai-chatbot.tsx'));
  assert.ok(prunePaths.includes('apps/web/src/routes/$locale/ai-chatbot.tsx'));
  assert.ok(prunePaths.includes('apps/web/src/routes/settings'));
  assert.ok(prunePaths.includes('apps/web/src/routes/api/auth.ts'));
});

test('withSiteRoutePruning prunes and restores native route files', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aooi-route-prune-'));
  const prunedRoute = path.join(rootDir, 'apps/web/src/routes/sign-in.tsx');
  const keptRoute = path.join(rootDir, 'apps/web/src/routes/index.tsx');
  const routeTree = path.join(rootDir, 'apps/web/src/routeTree.gen.ts');

  await mkdir(path.dirname(prunedRoute), { recursive: true });
  await writeFile(prunedRoute, 'export const Route = null;');
  await writeFile(keptRoute, 'export const Route = null;');
  await mkdir(path.dirname(routeTree), { recursive: true });
  await writeFile(routeTree, 'full route tree');

  try {
    await withSiteRoutePruning({
      rootDir,
      contract: freeToolContract,
      logger: { log() {} },
      async task() {
        await assert.rejects(readFile(prunedRoute, 'utf8'), /ENOENT/);
        assert.equal(
          await readFile(keptRoute, 'utf8'),
          'export const Route = null;'
        );
        await writeFile(routeTree, 'pruned route tree');
      },
    });

    assert.equal(
      await readFile(prunedRoute, 'utf8'),
      'export const Route = null;'
    );
    assert.equal(await readFile(routeTree, 'utf8'), 'full route tree');
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
