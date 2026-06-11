import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const rootDir = process.cwd();

test('localized TanStack routes pass locale through notFound data', async () => {
  const source = await readRepoFile('apps/web/src/routes/$locale/pricing.tsx');

  assert.match(
    source,
    /notFound\(\{[\s\S]*data:\s*\{[\s\S]*locale:\s*params\.locale[\s\S]*\}[\s\S]*\}\)/
  );
});

test('NotFoundSurfaceView reads locale from TanStack notFound data', async () => {
  const source = await readRepoFile(
    'src/surfaces/system/not-found/not-found.view.tsx'
  );

  assert.match(source, /props:\s*NotFoundRouteProps/);
  assert.match(
    source,
    /getTanStackNotFoundCopy\(getNotFoundLocale\(props\.data\)\)/
  );
});

async function readRepoFile(repoPath: string) {
  return await readFile(path.resolve(rootDir, repoPath), 'utf8');
}
