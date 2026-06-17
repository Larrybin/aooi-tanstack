import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isValidHyperdriveId,
  parseHyperdriveIdFromOutput,
  r2BucketListHasName,
} from '../../scripts/lib/cloudflare-provisioning.mjs';
import {
  assertPreviewSettingsCanProvision,
  buildPreviewCommandOriginalEnv,
  buildPreviewDeploySettingsJson,
  buildPreviewResourceNames,
} from '../../scripts/site-preview.mjs';
import siteEnvModule from '../../src/config/site-env.cjs';

const { applySiteLocalEnvOverlay } = siteEnvModule;

test('site preview resource names are derived from site key and workers.dev subdomain', () => {
  assert.deepEqual(
    buildPreviewResourceNames('background-remover', {
      CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
    }),
    {
      routerOrigin:
        'https://aooi-background-remover-preview-router.aooi-preview.workers.dev',
      routerWorker: 'aooi-background-remover-preview-router',
      storageBucket: 'aooi-background-remover-preview-storage',
    }
  );
});

test('site preview bucket detection matches exact R2 bucket names', () => {
  const output = `
[
  { name: 'aooi-background-remover-preview-storage' },
  { name: 'aooi-background-remover-preview-storage-extra' }
]
`;

  assert.equal(
    r2BucketListHasName(
      output,
      'aooi-background-remover-preview-storage'
    ),
    true
  );
  assert.equal(
    r2BucketListHasName(output, 'aooi-background-remover-preview'),
    false
  );
});

test('site preview command env pins preview profile over site env values', () => {
  const originalEnv = buildPreviewCommandOriginalEnv(
    {
      SITE: 'background-remover',
    },
    'background-remover'
  );
  const env = { ...originalEnv };

  applySiteLocalEnvOverlay({
    env,
    originalEnv,
    rootDir: '/repo',
    siteKey: 'background-remover',
    readFileSyncImpl() {
      return `
CF_DEPLOY_PROFILE=production
DATABASE_URL=postgresql://site-local-db
PREVIEW_DATABASE_URL=postgresql://preview-db
CF_WORKERS_DEV_SUBDOMAIN=aooi-preview
`;
    },
  });

  assert.equal(env.CF_DEPLOY_PROFILE, 'preview');
  assert.equal(env.DATABASE_URL, 'postgresql://preview-db');
  assert.equal(
    env.STORAGE_PUBLIC_BASE_URL,
    'https://aooi-background-remover-preview-router.aooi-preview.workers.dev/assets/'
  );
});

test('site preview provision fails fast on invalid preview deploy settings', () => {
  assert.throws(
    () =>
      assertPreviewSettingsCanProvision({
        previewSettings: {
          error:
            'site deploy preview settings.resources.hyperdriveId must be valid',
          filePath:
            '/repo/sites/background-remover/deploy.preview.settings.json',
          state: 'invalid',
        },
        rootDir: '/repo',
      }),
    /invalid sites\/background-remover\/deploy\.preview\.settings\.json: site deploy preview settings\.resources\.hyperdriveId must be valid/
  );
});

test('site preview Hyperdrive id parser reads Wrangler output', () => {
  assert.equal(
    parseHyperdriveIdFromOutput(
      'Created Hyperdrive config\nid: 0123456789abcdef0123456789abcdef\n'
    ),
    '0123456789abcdef0123456789abcdef'
  );
  assert.equal(
    parseHyperdriveIdFromOutput(
      'Created 0123456789abcdef0123456789abcdef successfully'
    ),
    '0123456789abcdef0123456789abcdef'
  );
  assert.equal(parseHyperdriveIdFromOutput('Created without id'), '');
});

test('site preview deploy settings JSON stays narrow', () => {
  assert.equal(isValidHyperdriveId('0123456789abcdef0123456789abcdef'), true);
  assert.equal(
    isValidHyperdriveId('replace_with_preview_hyperdrive_id'),
    false
  );
  assert.equal(
    buildPreviewDeploySettingsJson('0123456789abcdef0123456789abcdef'),
    `{
  "configVersion": 1,
  "resources": {
    "hyperdriveId": "0123456789abcdef0123456789abcdef"
  }
}
`
  );
  assert.throws(
    () => buildPreviewDeploySettingsJson('replace_with_preview_hyperdrive_id'),
    /preview Hyperdrive id/
  );
});
