import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BACKGROUND_REMOVER_RUNTIME_CONTRACT } from '../../src/domains/background-remover/domain/runtime-contract';
import type { ProductRuntimeContract } from '../../src/domains/product-runtime/domain/contract';
import { AI_REMOVER_RUNTIME_CONTRACT } from '../../src/domains/remover/domain/runtime-contract';
import { TEXT_TO_SPEECH_GENERATOR_RUNTIME_CONTRACT } from '../../src/domains/text-to-speech-generator/domain/runtime-contract';

export const DEPLOY_SETTINGS_CONFIG_VERSION = 2;

const WORKER_NAME_PATTERN =
  /^(?=.{1,63}$)(?!-)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const R2_BUCKET_NAME_PATTERN =
  /^(?=.{3,63}$)(?!.*\.\.)(?!-)(?!.*-$)(?!.*\.-)(?!.*-\.)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
const HYPERDRIVE_ID_PATTERN = /^[a-f0-9]{32}$/;

const DATABASE_MODULES = new Set([
  'auth',
  'billing',
  'admin_settings',
  'storage',
  'affiliate',
  'customer_service',
  'ads',
]);

const PRODUCT_RUNTIME_CONTRACTS: readonly ProductRuntimeContract[] = [
  AI_REMOVER_RUNTIME_CONTRACT,
  BACKGROUND_REMOVER_RUNTIME_CONTRACT,
  TEXT_TO_SPEECH_GENERATOR_RUNTIME_CONTRACT,
];

type SiteConfig = {
  key: string;
  domain: string;
  brand: {
    appUrl: string;
  };
  capabilities: {
    enabledModules: string[];
    paymentProvider: 'none' | 'stripe' | 'creem' | 'paypal';
  };
  i18n?: {
    strictPublishing?: boolean;
  };
};

export type DeploySettingsV2 = {
  configVersion: 2;
  workers: {
    app: string;
    state?: string;
  };
  resources: {
    hyperdriveId?: string;
    appStorageBucket?: string;
  };
};

export type SiteCloudflareContract = {
  site: SiteConfig;
  siteKey: string;
  deploySettings: DeploySettingsV2;
  workers: DeploySettingsV2['workers'];
  resources: DeploySettingsV2['resources'];
  requires: {
    database: boolean;
    r2: boolean;
    state: boolean;
    workersAi: boolean;
  };
  requiredSecrets: string[];
  requiredVars: string[];
  productRuntimeContracts: readonly ProductRuntimeContract[];
};

function assertPlainObject(
  value: unknown,
  label: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  label: string,
  required: readonly string[],
  optional: readonly string[] = []
) {
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !(key in value));
  if (unknown.length || missing.length) {
    throw new Error(
      `${label} keys are invalid` +
        (missing.length ? `; missing: ${missing.join(', ')}` : '') +
        (unknown.length ? `; unknown: ${unknown.join(', ')}` : '')
    );
  }
}

function assertNonEmptyString(
  value: unknown,
  label: string
): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function assertWorkerName(value: unknown, label: string) {
  assertNonEmptyString(value, label);
  if (!WORKER_NAME_PATTERN.test(value)) {
    throw new Error(`${label} must be a Cloudflare-safe worker name`);
  }
}

function enabledRequirements(requirements?: Readonly<Record<string, boolean>>) {
  return Object.entries(requirements ?? {})
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
}

function getProductContracts(siteKey: string) {
  return PRODUCT_RUNTIME_CONTRACTS.filter(
    (contract) => contract.siteKey === siteKey
  );
}

function deriveRequirements(
  site: SiteConfig,
  productRuntimeContracts: readonly ProductRuntimeContract[]
) {
  const modules = new Set(site.capabilities.enabledModules);
  const productBindings = productRuntimeContracts.flatMap((contract) =>
    enabledRequirements(contract.requiredBindings)
  );
  const productResources = productRuntimeContracts.flatMap((contract) =>
    enabledRequirements(contract.requiredResources)
  );
  const productSecrets = productRuntimeContracts.flatMap((contract) =>
    enabledRequirements(contract.requiredSecrets)
  );
  const productVars = productRuntimeContracts.flatMap((contract) =>
    enabledRequirements(contract.requiredVars)
  );
  const paymentProvider = site.capabilities.paymentProvider;

  const requiredSecrets = new Set<string>();
  if (modules.has('auth')) {
    requiredSecrets.add('AUTH_SHARED_SECRET');
    requiredSecrets.add('BETTER_AUTH_SECRET');
    requiredSecrets.add('RESEND_API_KEY');
  }
  if (paymentProvider === 'stripe') {
    requiredSecrets.add('STRIPE_PUBLISHABLE_KEY');
    requiredSecrets.add('STRIPE_SECRET_KEY');
    requiredSecrets.add('STRIPE_SIGNING_SECRET');
  } else if (paymentProvider === 'creem') {
    requiredSecrets.add('CREEM_API_KEY');
    requiredSecrets.add('CREEM_SIGNING_SECRET');
  } else if (paymentProvider === 'paypal') {
    requiredSecrets.add('PAYPAL_CLIENT_ID');
    requiredSecrets.add('PAYPAL_CLIENT_SECRET');
    requiredSecrets.add('PAYPAL_WEBHOOK_ID');
  }

  const secretNames: Record<string, string> = {
    removerCleanup: 'REMOVER_CLEANUP_SECRET',
    turnstile: 'TURNSTILE_SECRET_KEY',
  };
  for (const key of productSecrets) {
    const name = secretNames[key];
    if (name) requiredSecrets.add(name);
  }

  const requiredVars = new Set<string>();
  if (modules.has('storage') || productVars.includes('storagePublicBaseUrl')) {
    requiredVars.add('STORAGE_PUBLIC_BASE_URL');
  }
  if (productSecrets.includes('turnstile')) {
    requiredVars.add('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
  }

  return {
    database: [...modules].some((moduleId) => DATABASE_MODULES.has(moduleId)),
    r2: modules.has('storage') || productResources.includes('r2'),
    state: modules.has('auth') || productResources.includes('state'),
    workersAi: productBindings.includes('workersAi'),
    requiredSecrets: [...requiredSecrets].sort(),
    requiredVars: [...requiredVars].sort(),
  };
}

export function validateDeploySettingsV2(
  value: unknown,
  {
    site,
    productRuntimeContracts = getProductContracts(site.key),
  }: {
    site: SiteConfig;
    productRuntimeContracts?: readonly ProductRuntimeContract[];
  }
): asserts value is DeploySettingsV2 {
  assertPlainObject(value, 'site deploy settings');
  assertExactKeys(value, 'site deploy settings', [
    'configVersion',
    'workers',
    'resources',
  ]);
  if (value.configVersion !== DEPLOY_SETTINGS_CONFIG_VERSION) {
    throw new Error(
      `site deploy settings.configVersion must equal ${DEPLOY_SETTINGS_CONFIG_VERSION}`
    );
  }

  assertPlainObject(value.workers, 'site deploy settings.workers');
  assertExactKeys(
    value.workers,
    'site deploy settings.workers',
    ['app'],
    ['state']
  );
  assertWorkerName(value.workers.app, 'site deploy settings.workers.app');
  if ('state' in value.workers) {
    assertWorkerName(value.workers.state, 'site deploy settings.workers.state');
  }

  assertPlainObject(value.resources, 'site deploy settings.resources');
  assertExactKeys(
    value.resources,
    'site deploy settings.resources',
    [],
    ['hyperdriveId', 'appStorageBucket']
  );
  if ('hyperdriveId' in value.resources) {
    assertNonEmptyString(
      value.resources.hyperdriveId,
      'site deploy settings.resources.hyperdriveId'
    );
    if (!HYPERDRIVE_ID_PATTERN.test(value.resources.hyperdriveId as string)) {
      throw new Error(
        'site deploy settings.resources.hyperdriveId must be a valid Hyperdrive id'
      );
    }
  }
  if ('appStorageBucket' in value.resources) {
    assertNonEmptyString(
      value.resources.appStorageBucket,
      'site deploy settings.resources.appStorageBucket'
    );
    if (
      !R2_BUCKET_NAME_PATTERN.test(value.resources.appStorageBucket as string)
    ) {
      throw new Error(
        'site deploy settings.resources.appStorageBucket must be a valid R2 bucket name'
      );
    }
  }

  const requirements = deriveRequirements(site, productRuntimeContracts);
  if (requirements.database !== 'hyperdriveId' in value.resources) {
    throw new Error(
      `SITE=${site.key} Hyperdrive resource must match derived database requirement`
    );
  }
  if (requirements.r2 !== 'appStorageBucket' in value.resources) {
    throw new Error(
      `SITE=${site.key} R2 resource must match derived storage requirement`
    );
  }
  if (requirements.state !== 'state' in value.workers) {
    throw new Error(
      `SITE=${site.key} state worker must match derived limiter requirement`
    );
  }
}

export function listSiteKeys({ rootDir = process.cwd() } = {}) {
  const sitesDir = path.resolve(rootDir, 'sites');
  return readdirSync(sitesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(
      (siteKey) =>
        existsSync(path.join(sitesDir, siteKey, 'site.config.json')) &&
        existsSync(path.join(sitesDir, siteKey, 'deploy.settings.json'))
    )
    .sort();
}

export function resolveSiteCloudflareContract({
  rootDir = process.cwd(),
  siteKey = process.env.SITE?.trim(),
}: {
  rootDir?: string;
  siteKey?: string;
} = {}): SiteCloudflareContract {
  if (!siteKey) {
    throw new Error('SITE is required');
  }

  const site = JSON.parse(
    readFileSync(
      path.join(rootDir, 'sites', siteKey, 'site.config.json'),
      'utf8'
    )
  ) as SiteConfig;
  const deploySettings = JSON.parse(
    readFileSync(
      path.join(rootDir, 'sites', siteKey, 'deploy.settings.json'),
      'utf8'
    )
  ) as unknown;
  const productRuntimeContracts = getProductContracts(siteKey);

  if (site.key !== siteKey) {
    throw new Error(`site key mismatch: expected ${siteKey}, got ${site.key}`);
  }
  validateDeploySettingsV2(deploySettings, {
    site,
    productRuntimeContracts,
  });
  const requirements = deriveRequirements(site, productRuntimeContracts);

  return {
    site,
    siteKey,
    deploySettings,
    workers: deploySettings.workers,
    resources: deploySettings.resources,
    requires: {
      database: requirements.database,
      r2: requirements.r2,
      state: requirements.state,
      workersAi: requirements.workersAi,
    },
    requiredSecrets: requirements.requiredSecrets,
    requiredVars: requirements.requiredVars,
    productRuntimeContracts,
  };
}
