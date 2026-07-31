import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  listConfiguredSiteKeys,
  readCurrentSiteConfig,
} from '../../scripts/lib/site-config.mjs';
import { buildSiteRouteIgnorePattern } from '../../scripts/lib/site-route-assembly.mjs';

test('route assembly enables only configured module and site groups', () => {
  const site = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: '401k-calculator',
  });
  const ignored = new RegExp(
    buildSiteRouteIgnorePattern({ rootDir: process.cwd(), site })
  );

  assert.equal(ignored.test('(module_auth)'), true);
  assert.equal(ignored.test('(module_analytics)'), false);
  assert.equal(ignored.test('(site_ai-remover)'), true);
  assert.equal(ignored.test('(site_401k-calculator)'), false);
});

test('adding a site config automatically joins the site matrix', async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'aooi-site-matrix-'));
  const siteDir = path.join(rootDir, 'sites', 'new-site');
  await mkdir(siteDir, { recursive: true });
  await writeFile(path.join(siteDir, 'site.config.json'), '{}');

  try {
    assert.deepEqual(listConfiguredSiteKeys(rootDir), ['new-site']);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
