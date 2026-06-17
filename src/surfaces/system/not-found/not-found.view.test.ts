import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { resolveNotFoundLocale } from './not-found.locale';

const rootDir = process.cwd();

test('localized TanStack routes pass locale through notFound data', async () => {
  const source = await readRepoFile('apps/web/src/routes/$locale/pricing.tsx');

  assert.match(
    source,
    /notFound\(\{[\s\S]*data:\s*\{[\s\S]*locale:\s*params\.locale[\s\S]*\}[\s\S]*\}\)/
  );
});

test('My Images TanStack routes stay scoped to ai-remover', async () => {
  const rootRoute = await readRepoFile('apps/web/src/routes/my-images.tsx');
  const localizedRoute = await readRepoFile(
    'apps/web/src/routes/$locale/my-images.tsx'
  );

  assert.match(rootRoute, /site\.key[\s\S]*!==\s*'ai-remover'/);
  assert.match(rootRoute, /throw\s+notFound\(\)/);
  assert.match(localizedRoute, /site\.key[\s\S]*!==\s*'ai-remover'/);
  assert.match(
    localizedRoute,
    /throw\s+notFound\(\{[\s\S]*data:\s*\{[\s\S]*locale:\s*params\.locale[\s\S]*\}[\s\S]*\}\)/
  );
});

test('not-found locale resolution prefers data and falls back to URL prefix', () => {
  assert.equal(
    resolveNotFoundLocale({ locale: 'zh-TW' }, '/zh/does-not-exist'),
    'zh-TW'
  );
  assert.equal(resolveNotFoundLocale(undefined, '/zh/does-not-exist'), 'zh');
  assert.equal(
    resolveNotFoundLocale(undefined, '/zh-TW/does-not-exist'),
    'zh-TW'
  );
  assert.equal(resolveNotFoundLocale(undefined, '/does-not-exist'), undefined);
});

test('NotFoundSurfaceView resolves locale from TanStack data and location', async () => {
  const source = await readRepoFile(
    'src/surfaces/system/not-found/not-found.view.tsx'
  );

  assert.match(source, /props:\s*NotFoundRouteProps/);
  assert.match(
    source,
    /useLocation\(\{\s*select:\s*\(location\)\s*=>\s*location\.pathname\s*\}\)/
  );
  assert.match(
    source,
    /getTanStackNotFoundCopy\([\s\S]*resolveNotFoundLocale\(props\.data,\s*pathname\)[\s\S]*\)/
  );
});

async function readRepoFile(repoPath: string) {
  return await readFile(path.resolve(rootDir, repoPath), 'utf8');
}
