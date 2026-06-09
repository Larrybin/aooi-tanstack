import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkSiteContract,
  deriveSiteProductProfile,
} from '../../scripts/site-contract.mjs';

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

test('site contract derives free-tool-no-db from capabilities and bindings', () => {
  assert.equal(deriveSiteProductProfile(freeToolContract), 'free-tool-no-db');
  assert.equal(
    deriveSiteProductProfile({
      ...freeToolContract,
      bindingRequirements: {
        bindings: {
          hyperdrive: true,
        },
      },
    }),
    'custom'
  );
});

test('site contract enforces mp4-compressor free-tool-no-db invariants', () => {
  const result = checkSiteContract({
    rootDir: process.cwd(),
    siteKey: 'mp4-compressor',
    processEnv: {},
  });

  assert.equal(result.profile, 'free-tool-no-db');
  assert.deepEqual(result.failures, []);
  assert.ok(result.prunePaths.includes('src/app/api/config'));
  assert.ok(result.prunePaths.includes('src/app/[locale]/(landing)/pricing'));
});

test('site contract keeps SaaS sites on the custom profile', () => {
  const result = checkSiteContract({
    rootDir: process.cwd(),
    siteKey: 'background-remover',
    processEnv: {},
  });

  assert.equal(result.profile, 'custom');
  assert.deepEqual(result.failures, []);
});
