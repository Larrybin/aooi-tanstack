import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import siteEnvModule from '../../src/config/site-env.cjs';

const execFileAsync = promisify(execFile);
const loadDotenvPath = path.resolve(process.cwd(), 'src/config/load-dotenv.ts');

const {
  applySiteLocalEnvOverlay,
  parseSiteEnvFileContent,
  readSiteLocalEnv,
  resolveSiteLocalEnvPath,
} = siteEnvModule;

test('parseSiteEnvFileContent parses simple local env assignments', () => {
  assert.deepEqual(
    parseSiteEnvFileContent(`
# comment
DATABASE_URL = "postgresql://site-db"
REMOVER_AI_PROVIDER=cloudflare-workers-ai
export REMOVER_AI_MODEL='@cf/runwayml/stable-diffusion-v1-5-inpainting'
INVALID LINE
1_BAD=value
`),
    {
      DATABASE_URL: 'postgresql://site-db',
      REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
      REMOVER_AI_MODEL: '@cf/runwayml/stable-diffusion-v1-5-inpainting',
    }
  );
});

test('readSiteLocalEnv reads only the selected site env file', () => {
  const rootDir = '/repo';
  const requestedPaths: string[] = [];

  const env = readSiteLocalEnv({
    rootDir,
    siteKey: 'ai-remover',
    readFileSyncImpl(filePath: string) {
      requestedPaths.push(filePath);
      assert.equal(
        filePath,
        path.join(rootDir, 'sites', 'ai-remover', '.env.local')
      );
      return 'DATABASE_URL=postgresql://ai-remover';
    },
  });

  assert.deepEqual(env, {
    DATABASE_URL: 'postgresql://ai-remover',
  });
  assert.deepEqual(requestedPaths, [
    path.join(rootDir, 'sites', 'ai-remover', '.env.local'),
  ]);
  assert.equal(
    resolveSiteLocalEnvPath({ rootDir, siteKey: 'mamamiya' }),
    path.join(rootDir, 'sites', 'mamamiya', '.env.local')
  );
});

test('readSiteLocalEnv treats missing site env as empty', () => {
  assert.deepEqual(
    readSiteLocalEnv({
      rootDir: '/repo',
      siteKey: 'ai-remover',
      readFileSyncImpl() {
        const error = new Error('missing') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      },
    }),
    {}
  );
});

test('applySiteLocalEnvOverlay lets site env override root-loaded env but not shell env', () => {
  const env = {
    SITE: 'ai-remover',
    DATABASE_URL: 'postgresql://root-db',
    CREEM_API_KEY: 'shell-creem',
  };
  const originalEnv = {
    SITE: 'ai-remover',
    CREEM_API_KEY: 'shell-creem',
  };

  applySiteLocalEnvOverlay({
    env,
    originalEnv,
    rootDir: '/repo',
    siteKey: 'ai-remover',
    readFileSyncImpl() {
      return `
SITE=mamamiya
DATABASE_URL=postgresql://site-db
CREEM_API_KEY=site-creem
REMOVER_AI_PROVIDER=cloudflare-workers-ai
`;
    },
  });

  assert.deepEqual(env, {
    SITE: 'ai-remover',
    DATABASE_URL: 'postgresql://site-db',
    CREEM_API_KEY: 'shell-creem',
    REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
  });
});

test('load-dotenv applies selected site local env after root env loading', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'aooi-site-env-'));
  await mkdir(path.join(tempRoot, 'sites', 'ai-remover'), {
    recursive: true,
  });
  await writeFile(
    path.join(tempRoot, '.env.development'),
    'DATABASE_URL=postgresql://root-db\nDATABASE_PROVIDER=postgresql\n',
    'utf8'
  );
  await writeFile(
    path.join(tempRoot, 'sites', 'ai-remover', '.env.local'),
    'DATABASE_URL=postgresql://site-db\nREMOVER_AI_PROVIDER=cloudflare-workers-ai\n',
    'utf8'
  );

  const result = await execFileAsync(
    process.execPath,
    [
      '--import',
      'tsx',
      '-e',
      `process.chdir(${JSON.stringify(tempRoot)}); await import(${JSON.stringify(loadDotenvPath)}); console.log(JSON.stringify({ databaseUrl: process.env.DATABASE_URL, provider: process.env.REMOVER_AI_PROVIDER }));`,
    ],
    {
      cwd: process.cwd(),
      env: {
        NODE_ENV: 'development',
        SITE: 'ai-remover',
        PATH: process.env.PATH,
      },
    }
  );

  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    databaseUrl: 'postgresql://site-db',
    provider: 'cloudflare-workers-ai',
  });
});
