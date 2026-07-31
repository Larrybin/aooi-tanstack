import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { defineProductRuntimeContract } from '../domain/contract';
import {
  assertProductRuntimeContract,
  checkProductRuntimeContract,
  ProductRuntimeContractError,
} from './assert-runtime-contract';

const aiRemoverRuntimeContract = defineProductRuntimeContract({
  siteKey: 'ai-remover',
  productKey: 'ai-remover',
  requiredWorkers: {
    app: true,
  },
  requiredBindings: {
    workersAi: true,
  },
  requiredResources: {
    r2: true,
    state: true,
  },
  requiredVars: {
    storagePublicBaseUrl: true,
  },
  requiredSecrets: {
    removerCleanup: true,
  },
});

const validTarget = {
  siteKey: 'ai-remover',
  workers: {
    app: 'aooi-ai-remover-router',
    state: 'aooi-ai-remover-state',
  },
  runtime: {
    bindings: {
      workersAi: true,
    },
    resources: {
      r2: true,
      state: true,
    },
    vars: {
      storagePublicBaseUrl: true,
    },
    secrets: {
      removerCleanup: true,
    },
  },
};

test('assertProductRuntimeContract accepts matching product runtime requirements', () => {
  const result = assertProductRuntimeContract({
    contract: aiRemoverRuntimeContract,
    target: validTarget,
  });

  assert.deepEqual(result.required, {
    workers: ['app'],
    bindings: ['workersAi'],
    resources: ['r2', 'state'],
    vars: ['storagePublicBaseUrl'],
    secrets: ['removerCleanup'],
  });
});

test('checkProductRuntimeContract reports missing bindings, vars, secrets, and workers', () => {
  const result = checkProductRuntimeContract({
    contract: aiRemoverRuntimeContract,
    target: {
      siteKey: 'ai-remover',
      workers: {},
      runtime: {
        bindings: {
          workersAi: false,
        },
        resources: {},
        vars: {},
        secrets: {},
      },
    },
  });

  assert.deepEqual(result.issues, [
    { code: 'missing_worker', key: 'app' },
    { code: 'missing_binding', key: 'workersAi' },
    { code: 'missing_resource', key: 'r2' },
    { code: 'missing_resource', key: 'state' },
    { code: 'missing_var', key: 'storagePublicBaseUrl' },
    { code: 'missing_secret', key: 'removerCleanup' },
  ]);
});

test('assertProductRuntimeContract throws a typed error for missing runtime contract requirements', () => {
  assert.throws(
    () =>
      assertProductRuntimeContract({
        contract: aiRemoverRuntimeContract,
        target: {
          ...validTarget,
          runtime: {
            ...validTarget.runtime,
            secrets: {
              removerCleanup: false,
            },
          },
        },
      }),
    (error) =>
      error instanceof ProductRuntimeContractError &&
      error.issues.length === 1 &&
      error.issues[0]?.code === 'missing_secret' &&
      error.issues[0]?.key === 'removerCleanup'
  );
});

test('product-runtime source files do not import remover', () => {
  const root = path.join(process.cwd(), 'src/domains/product-runtime');
  const files = ['domain', 'application'].flatMap((segment) =>
    readdirSync(path.join(root, segment))
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => path.join(root, segment, file))
  );

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /domains\/remover|@\/domains\/remover/);
  }
});
