import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './site-config.mjs';

export const DEPLOY_SETTINGS_CONFIG_VERSION = 1;

export const CLOUDFLARE_WORKER_SLOT_KEYS = Object.freeze([
  'router',
  'state',
  'public-web',
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
]);

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
]);

export const CLOUDFLARE_VAR_REQUIREMENT_KEYS = Object.freeze([
  'storagePublicBaseUrl',
]);

export const CLOUDFLARE_BINDING_REQUIREMENT_KEYS = Object.freeze(['workersAi']);

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
  assertClosedObject(
    workers,
    'site deploy settings.workers',
    CLOUDFLARE_WORKER_SLOT_KEYS
  );

  for (const key of CLOUDFLARE_WORKER_SLOT_KEYS) {
    assertWorkerName(workers[key], `site deploy settings.workers.${key}`);
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

function assertCrossContractConsistency(siteConfig) {
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
    assertCrossContractConsistency(siteConfig);
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
