import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './site-config.mjs';

export const DEPLOY_SETTINGS_CONFIG_VERSION = 1;

export const CLOUDFLARE_REQUIRED_WORKER_SLOT_KEYS = Object.freeze([
  'router',
  'state',
  'public-web',
]);

export const CLOUDFLARE_OPTIONAL_WORKER_SLOT_KEYS = Object.freeze([
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
]);

export const CLOUDFLARE_WORKER_SLOT_KEYS = Object.freeze([
  ...CLOUDFLARE_REQUIRED_WORKER_SLOT_KEYS,
  ...CLOUDFLARE_OPTIONAL_WORKER_SLOT_KEYS,
]);

export const CLOUDFLARE_SERVER_WORKER_SLOT_KEYS = Object.freeze([
  'public-web',
  ...CLOUDFLARE_OPTIONAL_WORKER_SLOT_KEYS,
]);

export const CLOUDFLARE_SPLIT_WORKER_SLOT_KEYS = Object.freeze([
  ...CLOUDFLARE_OPTIONAL_WORKER_SLOT_KEYS,
]);

const CLOUDFLARE_WORKER_SLOT_SET = new Set(CLOUDFLARE_WORKER_SLOT_KEYS);
const CLOUDFLARE_SERVER_WORKER_SLOT_SET = new Set(
  CLOUDFLARE_SERVER_WORKER_SLOT_KEYS
);

export const CLOUDFLARE_RESOURCE_SLOT_KEYS = Object.freeze([
  'incrementalCacheBucket',
  'appStorageBucket',
  'hyperdriveId',
]);

export const CLOUDFLARE_STATE_SLOT_KEYS = Object.freeze(['schemaVersion']);

export const CLOUDFLARE_SECRET_REQUIREMENT_KEYS = Object.freeze([
  'authSharedSecret',
  'googleOauth',
  'githubOauth',
  'removerCleanup',
  'turnstile',
]);

export const CLOUDFLARE_VAR_REQUIREMENT_KEYS = Object.freeze([
  'storagePublicBaseUrl',
]);

export const CLOUDFLARE_BINDING_REQUIREMENT_KEYS = Object.freeze([
  'hyperdrive',
  'workersAi',
]);

const FORBIDDEN_TOP_LEVEL_KEYS = Object.freeze([
  'payment',
  'auth',
  'ai',
  'featureFlags',
  'features',
  'runtime',
  'settings',
  'secrets',
  'secret',
]);

const WORKER_NAME_PATTERN =
  /^(?=.{1,63}$)(?!-)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const R2_BUCKET_NAME_PATTERN =
  /^(?=.{3,63}$)(?!.*\.\.)(?!-)(?!.*-$)(?!.*\.-)(?!.*-\.)(?!\d+\.\d+\.\d+\.\d+$)[a-z0-9][a-z0-9.-]*[a-z0-9]$/;
const HYPERDRIVE_ID_PATTERN = /^[a-f0-9]{32}$/;

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertClosedObject(value, label, expectedKeys) {
  assertPlainObject(value, label);
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
    throw new Error(
      `${label} must contain exactly: ${sortedExpectedKeys.join(', ')}`
    );
  }
}

function assertBoolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
}

function assertWorkerName(value, label) {
  assertNonEmptyString(value, label);
  if (!WORKER_NAME_PATTERN.test(value)) {
    throw new Error(`${label} must be a Cloudflare-safe worker name`);
  }
}

function assertBucketName(value, label) {
  assertNonEmptyString(value, label);
  if (!R2_BUCKET_NAME_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid R2 bucket name`);
  }
}

function assertHyperdriveId(value, label) {
  assertNonEmptyString(value, label);
  if (!HYPERDRIVE_ID_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid Hyperdrive id`);
  }
}

function assertSchemaVersion(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertNoForbiddenTopLevelKeys(config) {
  const forbiddenKeys = Object.keys(config).filter((key) =>
    FORBIDDEN_TOP_LEVEL_KEYS.includes(key)
  );
  if (forbiddenKeys.length > 0) {
    throw new Error(
      `site deploy settings contains forbidden infra-only fields: ${forbiddenKeys.join(', ')}`
    );
  }
}

function assertBindingRequirements(bindingRequirements) {
  assertClosedObject(
    bindingRequirements,
    'site deploy settings.bindingRequirements',
    ['bindings', 'secrets', 'vars']
  );

  assertClosedObject(
    bindingRequirements.bindings,
    'site deploy settings.bindingRequirements.bindings',
    CLOUDFLARE_BINDING_REQUIREMENT_KEYS
  );
  assertClosedObject(
    bindingRequirements.secrets,
    'site deploy settings.bindingRequirements.secrets',
    CLOUDFLARE_SECRET_REQUIREMENT_KEYS
  );
  assertClosedObject(
    bindingRequirements.vars,
    'site deploy settings.bindingRequirements.vars',
    CLOUDFLARE_VAR_REQUIREMENT_KEYS
  );

  for (const key of CLOUDFLARE_BINDING_REQUIREMENT_KEYS) {
    assertBoolean(
      bindingRequirements.bindings[key],
      `site deploy settings.bindingRequirements.bindings.${key}`
    );
  }

  for (const key of CLOUDFLARE_SECRET_REQUIREMENT_KEYS) {
    assertBoolean(
      bindingRequirements.secrets[key],
      `site deploy settings.bindingRequirements.secrets.${key}`
    );
  }

  for (const key of CLOUDFLARE_VAR_REQUIREMENT_KEYS) {
    assertBoolean(
      bindingRequirements.vars[key],
      `site deploy settings.bindingRequirements.vars.${key}`
    );
  }
}

function assertWorkers(workers) {
  assertPlainObject(workers, 'site deploy settings.workers');

  const workerKeys = Object.keys(workers);
  const unknownKeys = workerKeys.filter(
    (key) => !CLOUDFLARE_WORKER_SLOT_SET.has(key)
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `site deploy settings.workers contains unknown worker slot(s): ${unknownKeys.join(', ')}`
    );
  }

  const missingRequiredKeys = CLOUDFLARE_REQUIRED_WORKER_SLOT_KEYS.filter(
    (key) => !(key in workers)
  );
  if (missingRequiredKeys.length > 0) {
    throw new Error(
      `site deploy settings.workers is missing required worker slot(s): ${missingRequiredKeys.join(', ')}`
    );
  }

  if ('admin' in workers && !('auth' in workers)) {
    throw new Error(
      'site deploy settings.workers.admin requires auth worker slot'
    );
  }

  for (const key of workerKeys) {
    assertWorkerName(workers[key], `site deploy settings.workers.${key}`);
  }
}

export function getActiveWorkerSlots(settings) {
  const workers = settings?.workers;
  if (!workers || typeof workers !== 'object' || Array.isArray(workers)) {
    return [];
  }

  return CLOUDFLARE_WORKER_SLOT_KEYS.filter((slot) => slot in workers);
}

export function hasActiveWorkerSlot(settings, slot) {
  return getActiveWorkerSlots(settings).includes(slot);
}

export function getActiveServerWorkerSlots(settings) {
  return getActiveWorkerSlots(settings).filter((slot) =>
    CLOUDFLARE_SERVER_WORKER_SLOT_SET.has(slot)
  );
}

export function getActiveSplitWorkerSlots(settings) {
  return getActiveWorkerSlots(settings).filter(
    (slot) => slot !== 'router' && slot !== 'state' && slot !== 'public-web'
  );
}

export function getActiveAppWorkerSlots(settings) {
  return getActiveWorkerSlots(settings).filter((slot) => slot !== 'state');
}

export function assertWorkerSlotEnabled(settings, slot) {
  if (!CLOUDFLARE_WORKER_SLOT_SET.has(slot)) {
    throw new Error(`Unknown Cloudflare worker "${slot}"`);
  }

  if (!hasActiveWorkerSlot(settings, slot)) {
    const siteKey = settings?.siteKey ? ` for SITE=${settings.siteKey}` : '';
    throw new Error(`Cloudflare worker "${slot}" is disabled${siteKey}`);
  }
}

function assertResources(resources) {
  assertClosedObject(
    resources,
    'site deploy settings.resources',
    CLOUDFLARE_RESOURCE_SLOT_KEYS
  );

  assertBucketName(
    resources.incrementalCacheBucket,
    'site deploy settings.resources.incrementalCacheBucket'
  );
  assertBucketName(
    resources.appStorageBucket,
    'site deploy settings.resources.appStorageBucket'
  );
  assertHyperdriveId(
    resources.hyperdriveId,
    'site deploy settings.resources.hyperdriveId'
  );
}

function assertState(state) {
  assertClosedObject(
    state,
    'site deploy settings.state',
    CLOUDFLARE_STATE_SLOT_KEYS
  );
  assertSchemaVersion(
    state.schemaVersion,
    'site deploy settings.state.schemaVersion'
  );
}

function assertCrossContractConsistency(siteConfig, workers) {
  if (
    siteConfig.key !== undefined &&
    siteConfig.key !== siteConfig.key?.trim()
  ) {
    throw new Error('site.key must be normalized');
  }

  const paymentCapability = siteConfig.capabilities.payment;

  if (
    paymentCapability !== 'none' &&
    !['stripe', 'creem', 'paypal'].includes(paymentCapability)
  ) {
    throw new Error(
      `site.config.json has unsupported payment capability: ${String(paymentCapability)}`
    );
  }

  const missingCapabilityWorkers = [];
  if (siteConfig.capabilities.auth && !('auth' in workers)) {
    missingCapabilityWorkers.push('auth (site.capabilities.auth)');
  }
  if (paymentCapability !== 'none' && !('payment' in workers)) {
    missingCapabilityWorkers.push('payment (site.capabilities.payment)');
  }
  if (siteConfig.capabilities.ai && !('chat' in workers)) {
    missingCapabilityWorkers.push('chat (site.capabilities.ai)');
  }

  if (missingCapabilityWorkers.length > 0) {
    throw new Error(
      `site deploy settings.workers is missing worker slot(s) required by site capabilities: ${missingCapabilityWorkers.join(', ')}`
    );
  }
}

export function validateSiteDeploySettings(config, { siteConfig = null } = {}) {
  assertClosedObject(config, 'site deploy settings', [
    'bindingRequirements',
    'configVersion',
    'resources',
    'state',
    'workers',
  ]);
  assertNoForbiddenTopLevelKeys(config);

  if (config.configVersion !== DEPLOY_SETTINGS_CONFIG_VERSION) {
    throw new Error(
      `site deploy settings.configVersion must equal ${DEPLOY_SETTINGS_CONFIG_VERSION}`
    );
  }

  assertBindingRequirements(config.bindingRequirements);
  assertWorkers(config.workers);
  assertResources(config.resources);
  assertState(config.state);

  if (siteConfig) {
    assertCrossContractConsistency(siteConfig, config.workers);
  }
}

export function validateSitePreviewDeploySettings(config) {
  assertClosedObject(config, 'site deploy preview settings', [
    'configVersion',
    'resources',
  ]);
  assertClosedObject(
    config.resources,
    'site deploy preview settings.resources',
    ['hyperdriveId']
  );

  if (config.configVersion !== DEPLOY_SETTINGS_CONFIG_VERSION) {
    throw new Error(
      `site deploy preview settings.configVersion must equal ${DEPLOY_SETTINGS_CONFIG_VERSION}`
    );
  }

  assertHyperdriveId(
    config.resources.hyperdriveId,
    'site deploy preview settings.resources.hyperdriveId'
  );
}

export function resolveSiteDeploySettingsPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(rootDir, 'sites', siteKey, 'deploy.settings.json');
}

export function resolveSitePreviewDeploySettingsPath({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  return path.resolve(
    rootDir,
    'sites',
    siteKey,
    'deploy.preview.settings.json'
  );
}

export function readSiteDeploySettings({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const sourcePath = resolveSiteDeploySettingsPath({ rootDir, siteKey });
  const raw = readFileSync(sourcePath, 'utf8');
  const config = JSON.parse(raw);
  const siteConfig = readCurrentSiteConfig({ rootDir, siteKey });

  validateSiteDeploySettings(config, { siteConfig });
  return config;
}

export function readSitePreviewDeploySettings({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const sourcePath = resolveSitePreviewDeploySettingsPath({ rootDir, siteKey });
  if (!existsSync(sourcePath)) {
    throw new Error(
      `missing preview deploy settings for SITE=${siteKey}: ${path.relative(
        rootDir,
        sourcePath
      )}`
    );
  }
  const raw = readFileSync(sourcePath, 'utf8');
  const config = JSON.parse(raw);

  validateSitePreviewDeploySettings(config);
  return config;
}
