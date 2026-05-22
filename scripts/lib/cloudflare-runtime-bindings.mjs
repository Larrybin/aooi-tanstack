import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits.ts';
import { resolveRequiredSiteKey } from './site-config.mjs';
import { resolveSiteDeployContract } from './site-deploy-contract.mjs';
import {
  getActiveAppWorkerSlots,
  getActiveWorkerSlots,
  hasActiveWorkerSlot,
} from './site-deploy-settings.mjs';

const {
  AUTH_HANDLER_WORKER_TARGETS,
  AUTH_UI_WORKER_TARGETS,
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
} = cloudflareWorkerSplits;

export const CLOUDFLARE_STATE_WORKER_SCOPE = Object.freeze(['state']);
export const CLOUDFLARE_APP_WORKER_SCOPE = Object.freeze([
  'router',
  ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
]);
export const CLOUDFLARE_ALL_WORKER_SCOPE = Object.freeze([
  ...CLOUDFLARE_STATE_WORKER_SCOPE,
  ...CLOUDFLARE_APP_WORKER_SCOPE,
]);
export const CLOUDFLARE_WORKER_SCOPES = Object.freeze({
  state: CLOUDFLARE_STATE_WORKER_SCOPE,
  app: CLOUDFLARE_APP_WORKER_SCOPE,
  all: CLOUDFLARE_ALL_WORKER_SCOPE,
});

export const CLOUDFLARE_SECRET_WORKER_ALLOWLIST = Object.freeze({
  BETTER_AUTH_SECRET: [
    'auth',
    'payment',
    'member',
    'chat',
    'admin',
    'public-web',
  ],
  AUTH_SECRET: ['auth', 'payment', 'member', 'chat', 'admin', 'public-web'],
  GOOGLE_CLIENT_ID: [
    ...new Set([...AUTH_HANDLER_WORKER_TARGETS, ...AUTH_UI_WORKER_TARGETS]),
  ],
  GOOGLE_CLIENT_SECRET: [...AUTH_HANDLER_WORKER_TARGETS],
  GITHUB_CLIENT_ID: [...AUTH_HANDLER_WORKER_TARGETS],
  GITHUB_CLIENT_SECRET: [...AUTH_HANDLER_WORKER_TARGETS],
  RESEND_API_KEY: ['auth', 'admin'],
  STRIPE_PUBLISHABLE_KEY: ['payment', 'member'],
  STRIPE_SECRET_KEY: ['payment', 'member'],
  STRIPE_SIGNING_SECRET: ['payment', 'member'],
  CREEM_API_KEY: ['payment', 'member'],
  CREEM_SIGNING_SECRET: ['payment', 'member'],
  PAYPAL_CLIENT_ID: ['payment', 'member'],
  PAYPAL_CLIENT_SECRET: ['payment', 'member'],
  PAYPAL_WEBHOOK_ID: ['payment', 'member'],
  OPENROUTER_API_KEY: ['chat'],
  AI_NOTIFY_WEBHOOK_SECRET: ['chat'],
  REMOVER_CLEANUP_SECRET: ['public-web'],
});

const ALLOWED_WORKER_KEYS = new Set(CLOUDFLARE_ALL_WORKER_SCOPE);
const SERVER_RUNTIME_WORKER_KEYS = Object.freeze([
  'public-web',
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
]);

function formatAllowedWorkerKeys() {
  return [
    ...Object.keys(CLOUDFLARE_WORKER_SCOPES),
    ...CLOUDFLARE_ALL_WORKER_SCOPE,
  ].join(', ');
}

function formatWorkerDisabledMessage(workerKey, contract) {
  return `Cloudflare worker "${workerKey}" is disabled for SITE=${contract.siteKey}`;
}

function pushRequirement(list, requirement) {
  list.push(requirement);
}

function assertSecretWorkerAllowed(name, workers) {
  const allowedWorkers = CLOUDFLARE_SECRET_WORKER_ALLOWLIST[name];
  if (!allowedWorkers) {
    throw new Error(`Missing Cloudflare secret worker allowlist for ${name}`);
  }

  for (const worker of workers) {
    if (!allowedWorkers.includes(worker)) {
      throw new Error(
        `Cloudflare secret ${name} is not allowed for worker ${worker}; update CLOUDFLARE_SECRET_WORKER_ALLOWLIST explicitly`
      );
    }
  }
}

function buildRequirementSignature(workerKey, requirement) {
  const names = requirement.names ?? [requirement.name];
  return `${workerKey}:${names.join('|')}`;
}

function createRequirementMap(contract = null) {
  const workerKeys = contract
    ? getActiveWorkerSlots(contract)
    : CLOUDFLARE_ALL_WORKER_SCOPE;
  return new Map(workerKeys.map((worker) => [worker, []]));
}

function addRequirementIfWorkerActive(requirements, worker, requirement) {
  const workerRequirements = requirements.get(worker);
  if (!workerRequirements) {
    return;
  }

  pushRequirement(workerRequirements, requirement);
}

function buildDeploySecretRequirementMap(contract) {
  const requirements = createRequirementMap(
    contract?.workers ? contract : null
  );
  const bindingRequirements = contract.bindingRequirements ?? contract;
  const { secrets, vars, payment } = bindingRequirements;

  if (vars.storagePublicBaseUrl) {
    for (const worker of ['router', ...SERVER_RUNTIME_WORKER_KEYS]) {
      addRequirementIfWorkerActive(requirements, worker, {
        kind: 'runtime-var',
        worker,
        name: 'STORAGE_PUBLIC_BASE_URL',
        requirement: 'storagePublicBaseUrl',
        capability: 'Cloudflare R2 public asset base URL',
      });
    }
  }

  if (secrets.authSharedSecret) {
    for (const worker of SERVER_RUNTIME_WORKER_KEYS) {
      addRequirementIfWorkerActive(requirements, worker, {
        kind: 'runtime-secret',
        worker,
        names: ['BETTER_AUTH_SECRET', 'AUTH_SECRET'],
        outputNames: ['BETTER_AUTH_SECRET', 'AUTH_SECRET'],
        requirement: 'authSharedSecret',
        capability: 'Next server runtime shared auth secret',
      });
    }
  }

  if (secrets.googleOauth) {
    for (const worker of AUTH_HANDLER_WORKER_TARGETS) {
      for (const name of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
        assertSecretWorkerAllowed(name, [worker]);
        addRequirementIfWorkerActive(requirements, worker, {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'googleOauth',
          capability: 'Google auth provider',
        });
      }
    }

    for (const worker of AUTH_UI_WORKER_TARGETS) {
      assertSecretWorkerAllowed('GOOGLE_CLIENT_ID', [worker]);
      addRequirementIfWorkerActive(requirements, worker, {
        kind: 'runtime-secret',
        worker,
        name: 'GOOGLE_CLIENT_ID',
        requirement: 'googleOauth',
        capability: 'Google One Tap auth UI',
      });
    }
  }

  if (secrets.githubOauth) {
    for (const worker of AUTH_HANDLER_WORKER_TARGETS) {
      for (const name of ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']) {
        assertSecretWorkerAllowed(name, [worker]);
        addRequirementIfWorkerActive(requirements, worker, {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'githubOauth',
          capability: 'GitHub auth provider',
        });
      }
    }
  }

  if (secrets.emailProvider) {
    assertSecretWorkerAllowed('RESEND_API_KEY', ['auth', 'admin']);
    for (const worker of ['auth', 'admin']) {
      addRequirementIfWorkerActive(requirements, worker, {
        kind: 'runtime-secret',
        worker,
        name: 'RESEND_API_KEY',
        requirement: 'emailProvider',
        capability: 'Email delivery provider',
      });
    }
  }

  if (secrets.removerCleanup) {
    assertSecretWorkerAllowed('REMOVER_CLEANUP_SECRET', ['public-web']);
    addRequirementIfWorkerActive(requirements, 'public-web', {
      kind: 'runtime-secret',
      worker: 'public-web',
      name: 'REMOVER_CLEANUP_SECRET',
      requirement: 'removerCleanup',
      capability: 'AI Remover expiration cleanup',
    });
  }

  if (payment.provider === 'stripe') {
    assertSecretWorkerAllowed('STRIPE_PUBLISHABLE_KEY', ['payment', 'member']);
    assertSecretWorkerAllowed('STRIPE_SECRET_KEY', ['payment', 'member']);
    assertSecretWorkerAllowed('STRIPE_SIGNING_SECRET', ['payment', 'member']);
    for (const worker of ['payment', 'member']) {
      for (const name of [
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_SECRET_KEY',
        'STRIPE_SIGNING_SECRET',
      ]) {
        addRequirementIfWorkerActive(requirements, worker, {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'payment',
          capability: 'Stripe payment provider',
        });
      }
    }
  }

  if (payment.provider === 'creem') {
    assertSecretWorkerAllowed('CREEM_API_KEY', ['payment', 'member']);
    assertSecretWorkerAllowed('CREEM_SIGNING_SECRET', ['payment', 'member']);
    for (const worker of ['payment', 'member']) {
      for (const name of ['CREEM_API_KEY', 'CREEM_SIGNING_SECRET']) {
        addRequirementIfWorkerActive(requirements, worker, {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'payment',
          capability: 'Creem payment provider',
        });
      }
    }
  }

  if (payment.provider === 'paypal') {
    assertSecretWorkerAllowed('PAYPAL_CLIENT_ID', ['payment', 'member']);
    assertSecretWorkerAllowed('PAYPAL_CLIENT_SECRET', ['payment', 'member']);
    assertSecretWorkerAllowed('PAYPAL_WEBHOOK_ID', ['payment', 'member']);
    for (const worker of ['payment', 'member']) {
      for (const name of [
        'PAYPAL_CLIENT_ID',
        'PAYPAL_CLIENT_SECRET',
        'PAYPAL_WEBHOOK_ID',
      ]) {
        addRequirementIfWorkerActive(requirements, worker, {
          kind: 'runtime-secret',
          worker,
          name,
          requirement: 'payment',
          capability: 'PayPal payment provider',
        });
      }
    }
  }

  if (secrets.openrouter) {
    assertSecretWorkerAllowed('OPENROUTER_API_KEY', ['chat']);
    addRequirementIfWorkerActive(requirements, 'chat', {
      kind: 'runtime-secret',
      worker: 'chat',
      name: 'OPENROUTER_API_KEY',
      requirement: 'openrouter',
      capability: 'Chat AI runtime',
    });
  }

  return requirements;
}

export function normalizeCloudflareWorkerKeys(
  workerKeys,
  { contract = null } = {}
) {
  if (!Array.isArray(workerKeys) || workerKeys.length === 0) {
    throw new Error(
      `Cloudflare worker scope is required. Use --workers=state|app|all|<comma-list>. Allowed values: ${formatAllowedWorkerKeys()}`
    );
  }

  const normalized = [
    ...new Set(
      workerKeys.map((workerKey) => String(workerKey).trim()).filter(Boolean)
    ),
  ];

  if (normalized.length === 0) {
    throw new Error(
      `Cloudflare worker scope is required. Use --workers=state|app|all|<comma-list>. Allowed values: ${formatAllowedWorkerKeys()}`
    );
  }

  for (const workerKey of normalized) {
    if (!ALLOWED_WORKER_KEYS.has(workerKey)) {
      throw new Error(
        `Unknown Cloudflare worker "${workerKey}". Allowed values: ${formatAllowedWorkerKeys()}`
      );
    }
    if (contract && !hasActiveWorkerSlot(contract, workerKey)) {
      throw new Error(formatWorkerDisabledMessage(workerKey, contract));
    }
  }

  return normalized;
}

export function resolveCloudflareWorkerKeys(
  value = 'all',
  { contract = null } = {}
) {
  const rawValue = String(value ?? '').trim();
  if (!rawValue) {
    throw new Error(
      `Cloudflare worker scope is required. Use --workers=state|app|all|<comma-list>. Allowed values: ${formatAllowedWorkerKeys()}`
    );
  }

  const namedScope = CLOUDFLARE_WORKER_SCOPES[rawValue];
  if (namedScope) {
    if (!contract) {
      return [...namedScope];
    }
    if (rawValue === 'state') {
      return ['state'];
    }
    if (rawValue === 'app') {
      return getActiveAppWorkerSlots(contract);
    }
    return ['state', ...getActiveAppWorkerSlots(contract)];
  }

  return normalizeCloudflareWorkerKeys(rawValue.split(','), { contract });
}

export function readCloudflareDeployRequirements({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  return resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(processEnv),
  }).bindingRequirements;
}

export function getRequiredRuntimeBindingsByWorker(
  bindingRequirements = readCloudflareDeployRequirements()
) {
  return buildDeploySecretRequirementMap({
    bindingRequirements,
  });
}

export function getRequiredRuntimeBindingsByContract(contract) {
  return buildDeploySecretRequirementMap(contract);
}

export function collectRequiredRuntimeBindings(
  workerKeys,
  bindingRequirements = readCloudflareDeployRequirements(),
  { contract = null } = {}
) {
  const normalizedWorkerKeys = normalizeCloudflareWorkerKeys(workerKeys, {
    contract,
  });
  const requirementsByWorker = contract
    ? getRequiredRuntimeBindingsByContract({
        ...contract,
        bindingRequirements,
      })
    : getRequiredRuntimeBindingsByWorker(bindingRequirements);
  const collected = [];
  const seen = new Set();

  for (const workerKey of normalizedWorkerKeys) {
    for (const requirement of requirementsByWorker.get(workerKey) || []) {
      const signature = buildRequirementSignature(workerKey, requirement);
      if (seen.has(signature)) {
        continue;
      }

      seen.add(signature);
      collected.push(requirement);
    }
  }

  return collected;
}

export function collectRequiredSecretNames(
  workerKeys,
  bindingRequirements = readCloudflareDeployRequirements(),
  { contract = null } = {}
) {
  return collectRequiredRuntimeBindings(workerKeys, bindingRequirements, {
    contract,
  })
    .filter((requirement) => requirement.kind === 'runtime-secret')
    .flatMap(
      (requirement) =>
        requirement.outputNames ?? requirement.names ?? [requirement.name]
    );
}
