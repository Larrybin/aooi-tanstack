import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLOUDFLARE_SECRET_WORKER_ALLOWLIST,
  getRequiredRuntimeBindingsByContract,
  getRequiredRuntimeBindingsByWorker,
} from '../../scripts/lib/cloudflare-runtime-bindings.mjs';
import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';

test('cloudflare runtime bindings: RESEND_API_KEY allowlist 固定为 auth/admin', () => {
  assert.deepEqual(CLOUDFLARE_SECRET_WORKER_ALLOWLIST.RESEND_API_KEY, [
    'auth',
    'admin',
  ]);
});

test('cloudflare runtime bindings: emailProvider 只分配到 auth/admin worker', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const requirements = getRequiredRuntimeBindingsByWorker(
    contract.bindingRequirements
  ) as Map<string, Array<{ name: string; worker: string }>>;

  const authSecrets = requirements
    .get('auth')
    ?.filter((item) => item.name === 'RESEND_API_KEY')
    .map((item) => item.worker);
  const adminSecrets = requirements
    .get('admin')
    ?.filter((item) => item.name === 'RESEND_API_KEY')
    .map((item) => item.worker);
  const paymentSecrets = requirements
    .get('payment')
    ?.filter((item) => item.name === 'RESEND_API_KEY');

  assert.deepEqual(authSecrets, ['auth']);
  assert.deepEqual(adminSecrets, ['admin']);
  assert.deepEqual(paymentSecrets, []);
});

test('cloudflare runtime bindings: preview profile 不要求 RESEND_API_KEY', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    deployProfile: 'preview',
    processEnv: {
      ...process.env,
      CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
    },
  });
  const requirements = getRequiredRuntimeBindingsByWorker(
    contract.bindingRequirements
  ) as Map<string, Array<{ name: string; worker: string }>>;

  assert.equal(contract.bindingRequirements.secrets.emailProvider, false);
  assert.deepEqual(
    requirements.get('auth')?.filter((item) => item.name === 'RESEND_API_KEY'),
    []
  );
  assert.deepEqual(
    requirements.get('admin')?.filter((item) => item.name === 'RESEND_API_KEY'),
    []
  );
});

test('cloudflare runtime bindings: remover cleanup secret 只分配到 public-web worker', () => {
  assert.deepEqual(CLOUDFLARE_SECRET_WORKER_ALLOWLIST.REMOVER_CLEANUP_SECRET, [
    'public-web',
  ]);

  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
  });
  const requirements = getRequiredRuntimeBindingsByWorker(
    contract.bindingRequirements
  ) as Map<string, Array<{ name: string; worker: string }>>;

  const publicWebSecrets = requirements
    .get('public-web')
    ?.filter((item) => item.name === 'REMOVER_CLEANUP_SECRET')
    .map((item) => item.worker);
  const authSecrets = requirements
    .get('auth')
    ?.filter((item) => item.name === 'REMOVER_CLEANUP_SECRET');

  assert.deepEqual(publicWebSecrets, ['public-web']);
  assert.deepEqual(authSecrets, []);
});

test('cloudflare runtime bindings: AI Remover 不要求 OpenRouter chat secret', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    deployProfile: 'preview',
    processEnv: {
      ...process.env,
      CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
    },
  });
  const requirements = getRequiredRuntimeBindingsByWorker(
    contract.bindingRequirements
  ) as Map<string, Array<{ name: string; worker: string }>>;

  assert.equal(contract.bindingRequirements.secrets.openrouter, false);
  assert.deepEqual(
    requirements
      .get('chat')
      ?.filter((item) => item.name === 'OPENROUTER_API_KEY') ?? [],
    []
  );
});

test('cloudflare runtime bindings: disabled chat 不进入 runtime secret map', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'ai-remover',
    deployProfile: 'preview',
    processEnv: {
      ...process.env,
      CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
    },
  });
  const requirements = getRequiredRuntimeBindingsByContract(contract) as Map<
    string,
    Array<{ name: string; worker: string }>
  >;

  assert.equal(requirements.has('chat'), false);
});
