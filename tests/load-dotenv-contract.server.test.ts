import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadDotenvForScripts,
  loadRootDotenv,
  shouldLoadDotenvForScripts,
} from '../src/config/load-dotenv-core.mjs';

function withTempProject(fn: (rootDir: string) => void | Promise<void>) {
  return async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), 'aooi-dotenv-'));
    try {
      await fn(rootDir);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  };
}

function write(rootDir: string, relativePath: string, content: string) {
  const fullPath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
}

test(
  'loadRootDotenv preserves existing process env values',
  withTempProject((rootDir) => {
    write(rootDir, '.env', 'EXISTING=file\nNEW_VALUE=file\n');
    const env = { EXISTING: 'shell' } as NodeJS.ProcessEnv;

    loadRootDotenv(env, { rootDir, nodeEnv: 'development' });

    assert.equal(env.EXISTING, 'shell');
    assert.equal(env.NEW_VALUE, 'file');
  })
);

test(
  '.env.local has higher effective priority than .env',
  withTempProject((rootDir) => {
    write(rootDir, '.env', 'VALUE=root\n');
    write(rootDir, '.env.local', 'VALUE=local\n');
    const env = {} as NodeJS.ProcessEnv;

    loadRootDotenv(env, { rootDir, nodeEnv: 'development' });

    assert.equal(env.VALUE, 'local');
  })
);

test(
  'production and development mode-specific files are selected by NODE_ENV/dev mode',
  withTempProject((rootDir) => {
    write(rootDir, '.env.development.local', 'VALUE=development\n');
    write(rootDir, '.env.production.local', 'VALUE=production\n');

    const devEnv = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
    loadRootDotenv(devEnv, { rootDir, nodeEnv: devEnv.NODE_ENV });
    assert.equal(devEnv.VALUE, 'development');

    const prodEnv = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
    loadRootDotenv(prodEnv, { rootDir, nodeEnv: prodEnv.NODE_ENV });
    assert.equal(prodEnv.VALUE, 'production');
  })
);

test(
  'SITE overlay reads only sites/<SITE>/.env.local and can override root dotenv values',
  withTempProject((rootDir) => {
    write(rootDir, '.env', 'VALUE=root\n');
    write(rootDir, 'sites/demo/.env', 'VALUE=site-env-should-not-load\n');
    write(rootDir, 'sites/demo/.env.local', 'VALUE=site-local\n');
    const env = { SITE: 'demo' } as NodeJS.ProcessEnv;
    const originalEnv = { ...env };

    loadDotenvForScripts({ env, originalEnv, rootDir });

    assert.equal(env.VALUE, 'site-local');
  })
);

test(
  'SITE overlay does not read sites/<SITE>/.env',
  withTempProject((rootDir) => {
    write(rootDir, '.env', 'VALUE=root\n');
    write(rootDir, 'sites/demo/.env', 'VALUE=site-env-should-not-load\n');
    const env = { SITE: 'demo' } as NodeJS.ProcessEnv;

    loadDotenvForScripts({ env, originalEnv: { ...env }, rootDir });

    assert.equal(env.VALUE, 'root');
  })
);

test(
  'SITE overlay does not override shell-provided env values',
  withTempProject((rootDir) => {
    write(rootDir, 'sites/demo/.env.local', 'VALUE=site-local\n');
    const env = { SITE: 'demo', VALUE: 'shell' } as NodeJS.ProcessEnv;

    loadDotenvForScripts({ env, originalEnv: { ...env }, rootDir });

    assert.equal(env.VALUE, 'shell');
  })
);

test(
  'NEXT_RUNTIME disables script dotenv loading',
  withTempProject((rootDir) => {
    write(rootDir, '.env', 'VALUE=root\n');
    const env = { NEXT_RUNTIME: 'edge' } as NodeJS.ProcessEnv;

    assert.equal(shouldLoadDotenvForScripts(env), false);
    const result = loadDotenvForScripts({ env, originalEnv: { ...env }, rootDir });

    assert.equal(result.loaded, false);
    assert.equal(env.VALUE, undefined);
  })
);

test('run-with-site uses the shared dotenv core and does not import @next/env', () => {
  const source = readFileSync('scripts/run-with-site.mjs', 'utf8');

  assert.match(source, /load-dotenv-core\.mjs/);
  assert.doesNotMatch(source, /@next\/env/);
});
