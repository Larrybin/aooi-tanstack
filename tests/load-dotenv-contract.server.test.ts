import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  loadDotenvForScripts,
  loadRootDotenv,
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
  'loadRootDotenv preserves Next-compatible expansion semantics',
  withTempProject((rootDir) => {
    write(
      rootDir,
      '.env',
      [
        'A=$B',
        'B=from-later',
        'FALLBACK=${MISSING:-fallback}',
        'HASH="value # literal"',
        String.raw`ESCAPED=\$HASH`,
        'EARLIER=from-earlier',
        'FROM_EARLIER=$EARLIER',
        'FROM_SHELL=$SHELL_VALUE',
        String.raw`SINGLE='line\ntext'`,
        String.raw`DOUBLE="line\ntext"`,
        '',
      ].join('\n')
    );
    const env = { SHELL_VALUE: 'from-shell' } as NodeJS.ProcessEnv;

    loadRootDotenv(env, { rootDir, nodeEnv: 'development' });

    assert.equal(env.A, 'from-later');
    assert.equal(env.B, 'from-later');
    assert.equal(env.FALLBACK, 'fallback');
    assert.equal(env.HASH, 'value # literal');
    assert.equal(env.ESCAPED, '$HASH');
    assert.equal(env.FROM_EARLIER, 'from-earlier');
    assert.equal(env.FROM_SHELL, 'from-shell');
    assert.equal(env.SINGLE, String.raw`line\ntext`);
    assert.equal(env.DOUBLE, 'line\ntext');
  })
);

test(
  'loadRootDotenv handles self-referential and cyclic expansion without recursion overflow',
  withTempProject((rootDir) => {
    write(
      rootDir,
      '.env',
      [
        'SELF=$SELF',
        'SELF_WITH_DEFAULT=${SELF_WITH_DEFAULT:-fallback}',
        'A=$B',
        'B=$A',
        'AFTER=ok',
        '',
      ].join('\n')
    );
    const env = {} as NodeJS.ProcessEnv;

    assert.doesNotThrow(() => {
      loadRootDotenv(env, { rootDir, nodeEnv: 'development' });
    });

    assert.equal(env.SELF, '');
    assert.equal(env.SELF_WITH_DEFAULT, 'fallback');
    assert.equal(env.A, '');
    assert.equal(env.B, '');
    assert.equal(env.AFTER, 'ok');
  })
);

test(
  'loadRootDotenv preserves quoted multiline values',
  withTempProject((rootDir) => {
    write(
      rootDir,
      '.env',
      [
        'PRIVATE_KEY="-----BEGIN KEY-----',
        'line2',
        '-----END KEY-----"',
        'NEXT_VALUE=ok',
        '',
      ].join('\n')
    );
    const env = {} as NodeJS.ProcessEnv;

    loadRootDotenv(env, { rootDir, nodeEnv: 'development' });

    assert.equal(
      env.PRIVATE_KEY,
      ['-----BEGIN KEY-----', 'line2', '-----END KEY-----'].join('\n')
    );
    assert.equal(env.NEXT_VALUE, 'ok');
  })
);

test(
  'loadDotenvForScripts silently skips root dotenv read failures',
  withTempProject((rootDir) => {
    const env = {} as NodeJS.ProcessEnv;

    assert.doesNotThrow(() => {
      const result = loadDotenvForScripts({
        env,
        originalEnv: { ...env },
        rootDir,
        existsSyncImpl: () => true,
        readFileSyncImpl: () => {
          throw Object.assign(new Error('permission denied'), {
            code: 'EACCES',
          });
        },
      });

      assert.equal(result.loaded, true);
      assert.deepEqual(result.loadedFiles, []);
    });
  })
);

test(
  'loadDotenvForScripts silently skips site dotenv read failures',
  withTempProject((rootDir) => {
    const env = { SITE: 'demo' } as NodeJS.ProcessEnv;

    assert.doesNotThrow(() => {
      const result = loadDotenvForScripts({
        env,
        originalEnv: { ...env },
        rootDir,
        existsSyncImpl: () => false,
        readFileSyncImpl: () => {
          throw Object.assign(new Error('permission denied'), {
            code: 'EACCES',
          });
        },
      });

      assert.equal(result.loaded, true);
      assert.deepEqual(result.loadedFiles, []);
    });
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

test('run-with-site uses the shared dotenv core', () => {
  const source = readFileSync('scripts/run-with-site.mjs', 'utf8');

  assert.match(source, /load-dotenv-core\.mjs/);
  assert.doesNotMatch(source, /@next\/env/);
  assert.match(
    source,
    /try\s*{\s*loadRootDotenv\(process\.env\);\s*}\s*catch\s*{/s
  );
});
