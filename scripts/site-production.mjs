import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import siteEnvModule from '../src/config/site-env.cjs';
import {
  assertWranglerSuccess,
  checkHyperdrive,
  checkR2Bucket,
  checkWorker,
  ensureR2Bucket,
  isValidHyperdriveId,
  parseHyperdriveIdFromOutput,
  printStatus,
  redactValues,
  runWrangler,
  stripAnsi,
  withCommandPathFallback,
} from './lib/cloudflare-provisioning.mjs';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import {
  readSiteDeploySettings,
  resolveSiteDeploySettingsPath,
  validateSiteDeploySettings,
} from './lib/site-deploy-settings.mjs';

const { applySiteLocalEnvOverlay, readSiteLocalEnv, resolveSiteLocalEnvPath } =
  siteEnvModule;

const PRODUCTION_MODE_CHOICES = ['doctor', 'init-settings', 'provision'];
const PRODUCTION_RELEASE_ENV_KEYS = Object.freeze([
  'DATABASE_PROVIDER',
  'RELEASE_TEST_DATABASE_URL',
  'PRODUCTION_DATABASE_URL',
  'STORAGE_PUBLIC_BASE_URL',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'RESEND_API_KEY',
]);
const PRODUCTION_DATABASE_ENV_KEYS = new Set([
  'DATABASE_PROVIDER',
  'RELEASE_TEST_DATABASE_URL',
  'PRODUCTION_DATABASE_URL',
]);
const PRODUCTION_AUTH_ENV_KEYS = new Set(['RESEND_API_KEY']);

function trimEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function relativePath(rootDir, targetPath) {
  return path.relative(rootDir, targetPath) || '.';
}

function resolveOperatorValue({ envFileValues, name, processEnv }) {
  if (hasOwnEnvValue(processEnv, name)) {
    return trimEnvValue(processEnv[name]);
  }

  return trimEnvValue(envFileValues[name]);
}

export function isProductionHyperdrivePlaceholder(hyperdriveId) {
  return /^0{32}$/u.test(hyperdriveId) || /^0{31}[1-9a-f]$/u.test(hyperdriveId);
}

export function buildProductionHyperdriveName(siteKey) {
  return `aooi-${siteKey}-db`;
}

export function buildProductionWorkerName(siteKey, slot) {
  return `aooi-${siteKey}-${slot}`;
}

export function buildProductionResourceNames(siteKey) {
  return {
    appStorageBucket: `aooi-${siteKey}-storage`,
  };
}

export function isProductionHyperdriveRequired(deploySettings) {
  return deploySettings.bindingRequirements.bindings.hyperdrive === true;
}

export function isProductionAuthRequired({ deploySettings, siteConfig }) {
  return (
    siteConfig.capabilities.auth !== false ||
    deploySettings.bindingRequirements.secrets.authSharedSecret === true
  );
}

export function getMissingProductionReleaseEnvNames(
  env,
  { authRequired = true, hyperdriveRequired = true } = {}
) {
  const missing = PRODUCTION_RELEASE_ENV_KEYS.filter((name) => {
    if (!hyperdriveRequired && PRODUCTION_DATABASE_ENV_KEYS.has(name)) {
      return false;
    }
    if (!authRequired && PRODUCTION_AUTH_ENV_KEYS.has(name)) {
      return false;
    }

    if (name === 'DATABASE_PROVIDER') {
      return trimEnvValue(env[name]) !== 'postgresql';
    }

    return !trimEnvValue(env[name]);
  });

  if (
    authRequired &&
    !trimEnvValue(env.BETTER_AUTH_SECRET) &&
    !trimEnvValue(env.AUTH_SECRET)
  ) {
    missing.push('BETTER_AUTH_SECRET or AUTH_SECRET');
  }

  return missing;
}

export function hasUnsafeProductionReleaseTestDatabase(
  env,
  { hyperdriveRequired = true } = {}
) {
  if (!hyperdriveRequired) {
    return false;
  }

  const releaseTestDatabaseUrl = trimEnvValue(env.RELEASE_TEST_DATABASE_URL);
  const productionDatabaseUrl = trimEnvValue(env.PRODUCTION_DATABASE_URL);
  return (
    Boolean(releaseTestDatabaseUrl) &&
    Boolean(productionDatabaseUrl) &&
    releaseTestDatabaseUrl === productionDatabaseUrl
  );
}

export function updateProductionDeploySettingsHyperdriveId(
  deploySettings,
  hyperdriveId
) {
  if (!isValidHyperdriveId(hyperdriveId)) {
    throw new Error(
      'production Hyperdrive id must be a 32-character lowercase hex value'
    );
  }

  return {
    ...deploySettings,
    resources: {
      ...deploySettings.resources,
      hyperdriveId,
    },
  };
}

export function updateProductionDeploySettingsNames({
  deploySettings,
  siteKey,
}) {
  const resourceNames = buildProductionResourceNames(siteKey);

  return {
    ...deploySettings,
    resources: {
      ...deploySettings.resources,
      ...resourceNames,
    },
    workers: Object.fromEntries(
      Object.keys(deploySettings.workers).map((slot) => [
        slot,
        buildProductionWorkerName(siteKey, slot),
      ])
    ),
  };
}

export function buildProductionDeploySettingsInitJson({
  deploySettings,
  siteConfig,
  siteKey,
}) {
  const nextSettings = updateProductionDeploySettingsNames({
    deploySettings,
    siteKey,
  });
  validateSiteDeploySettings(nextSettings, { siteConfig });
  return `${JSON.stringify(nextSettings, null, 2)}\n`;
}

export function buildProductionDeploySettingsJson({
  deploySettings,
  hyperdriveId,
  siteConfig,
}) {
  const nextSettings = updateProductionDeploySettingsHyperdriveId(
    deploySettings,
    hyperdriveId
  );
  validateSiteDeploySettings(nextSettings, { siteConfig });
  return `${JSON.stringify(nextSettings, null, 2)}\n`;
}

export function buildProductionCommandOriginalEnv(processEnv, siteKey) {
  return {
    ...processEnv,
    CF_DEPLOY_PROFILE: 'production',
    NODE_ENV: 'production',
    SITE: siteKey,
  };
}

function createProductionCommandEnv({
  rootDir,
  siteKey,
  processEnv = process.env,
}) {
  const originalEnv = buildProductionCommandOriginalEnv(processEnv, siteKey);
  const env = { ...originalEnv };

  applySiteLocalEnvOverlay({
    env,
    originalEnv,
    rootDir,
    siteKey,
  });

  return withCommandPathFallback(env, processEnv);
}

function createProductionContext({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  const siteKey = resolveRequiredSiteKey(processEnv);
  const siteConfig = readCurrentSiteConfig({ rootDir, siteKey });
  const deploySettings = readSiteDeploySettings({ rootDir, siteKey });
  const envFilePath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  const envFileValues = readSiteLocalEnv({ rootDir, siteKey });

  return {
    deploySettings,
    deploySettingsPath: resolveSiteDeploySettingsPath({ rootDir, siteKey }),
    envFilePath,
    productionDatabaseUrl: resolveOperatorValue({
      envFileValues,
      name: 'PRODUCTION_DATABASE_URL',
      processEnv,
    }),
    rootDir,
    siteConfig,
    siteKey,
    authRequired: isProductionAuthRequired({ deploySettings, siteConfig }),
    hyperdriveRequired: isProductionHyperdriveRequired(deploySettings),
  };
}

function requireProductionOperatorValues(context) {
  const missing = [];
  if (!existsSync(context.envFilePath)) {
    missing.push(`sites/${context.siteKey}/.env.local`);
  }
  if (context.hyperdriveRequired && !context.productionDatabaseUrl) {
    missing.push('PRODUCTION_DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `missing required production value(s): ${missing.join(', ')}`
    );
  }
}

function printProductionEnvStatus(env, { authRequired, hyperdriveRequired }) {
  const missing = getMissingProductionReleaseEnvNames(env, {
    authRequired,
    hyperdriveRequired,
  });
  const missingSet = new Set(missing);
  for (const name of PRODUCTION_RELEASE_ENV_KEYS) {
    if (!hyperdriveRequired && PRODUCTION_DATABASE_ENV_KEYS.has(name)) {
      printStatus('skip', name, 'Hyperdrive disabled');
      continue;
    }
    if (!authRequired && PRODUCTION_AUTH_ENV_KEYS.has(name)) {
      printStatus('skip', name, 'Auth disabled');
      continue;
    }

    if (missingSet.has(name)) {
      printStatus(
        'missing',
        name,
        name === 'DATABASE_PROVIDER' ? 'expected postgresql' : ''
      );
    } else {
      printStatus('ok', name);
    }
  }

  if (!authRequired) {
    printStatus('skip', 'BETTER_AUTH_SECRET or AUTH_SECRET', 'Auth disabled');
  } else if (missingSet.has('BETTER_AUTH_SECRET or AUTH_SECRET')) {
    printStatus('missing', 'BETTER_AUTH_SECRET or AUTH_SECRET');
  } else {
    printStatus('ok', 'BETTER_AUTH_SECRET or AUTH_SECRET');
  }

  if (hasUnsafeProductionReleaseTestDatabase(env, { hyperdriveRequired })) {
    printStatus(
      'error',
      'RELEASE_TEST_DATABASE_URL',
      'must not equal PRODUCTION_DATABASE_URL'
    );
    return missing.length + 1;
  }

  return missing.length;
}

function writeProductionDeploySettingsHyperdriveId(context, hyperdriveId) {
  writeFileSync(
    context.deploySettingsPath,
    buildProductionDeploySettingsJson({
      deploySettings: context.deploySettings,
      hyperdriveId,
      siteConfig: context.siteConfig,
    }),
    'utf8'
  );
  printStatus(
    'ok',
    'production deploy settings',
    relativePath(context.rootDir, context.deploySettingsPath)
  );
}

async function ensureProductionHyperdrive(context, env) {
  const currentHyperdriveId = context.deploySettings.resources.hyperdriveId;
  if (await checkHyperdrive(currentHyperdriveId, env)) {
    printStatus('ok', 'Hyperdrive config', currentHyperdriveId);
    return;
  }

  if (!isProductionHyperdrivePlaceholder(currentHyperdriveId)) {
    throw new Error(
      `configured production Hyperdrive id is not accessible: ${currentHyperdriveId}`
    );
  }

  const hyperdriveName = buildProductionHyperdriveName(context.siteKey);
  printStatus('create', 'Hyperdrive config', hyperdriveName);
  const result = await runWrangler(
    [
      'hyperdrive',
      'create',
      hyperdriveName,
      '--connection-string',
      context.productionDatabaseUrl,
      '--sslmode',
      'require',
    ],
    env
  );
  assertWranglerSuccess('create production Hyperdrive config', result, [
    context.productionDatabaseUrl,
  ]);

  const hyperdriveId = parseHyperdriveIdFromOutput(result.output);
  if (!hyperdriveId) {
    const output = redactValues(stripAnsi(result.output).trim(), [
      context.productionDatabaseUrl,
    ]);
    throw new Error(
      `created production Hyperdrive config but could not read its id from Wrangler output${output ? `:\n${output}` : ''}`
    );
  }

  writeProductionDeploySettingsHyperdriveId(context, hyperdriveId);
  printStatus('ok', 'Hyperdrive config', hyperdriveId);
}

async function runDoctor() {
  const context = createProductionContext();
  const env = createProductionCommandEnv(context);
  const resources = context.deploySettings.resources;
  let failures = 0;

  printStatus('ok', 'site', context.siteKey);
  printStatus(
    'ok',
    'deploy settings',
    relativePath(context.rootDir, context.deploySettingsPath)
  );

  if (existsSync(context.envFilePath)) {
    printStatus(
      'ok',
      'operator env',
      relativePath(context.rootDir, context.envFilePath)
    );
  } else {
    failures += 1;
    printStatus(
      'missing',
      'operator env',
      `create sites/${context.siteKey}/.env.local`
    );
  }

  failures += printProductionEnvStatus(env, {
    authRequired: context.authRequired,
    hyperdriveRequired: context.hyperdriveRequired,
  });

  try {
    if (await checkR2Bucket(resources.appStorageBucket, env)) {
      printStatus('ok', 'R2 bucket', resources.appStorageBucket);
    } else {
      failures += 1;
      printStatus('missing', 'R2 bucket', resources.appStorageBucket);
    }
  } catch (error) {
    failures += 1;
    printStatus(
      'error',
      'R2 bucket check',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (!context.hyperdriveRequired) {
    printStatus('skip', 'Hyperdrive config', 'Hyperdrive disabled');
  } else {
    const hyperdriveId = resources.hyperdriveId;
    if (await checkHyperdrive(hyperdriveId, env)) {
      printStatus('ok', 'Hyperdrive config', hyperdriveId);
    } else {
      failures += 1;
      printStatus(
        isProductionHyperdrivePlaceholder(hyperdriveId)
          ? 'placeholder'
          : 'missing',
        'Hyperdrive config',
        hyperdriveId
      );
    }
  }

  for (const [slot, workerName] of Object.entries(
    context.deploySettings.workers
  )) {
    try {
      if (await checkWorker(workerName, env)) {
        printStatus('ok', `worker.${slot}`, workerName);
      } else {
        failures += 1;
        printStatus('missing', `worker.${slot}`, workerName);
      }
    } catch (error) {
      failures += 1;
      printStatus(
        'error',
        `worker.${slot} check`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (failures > 0) {
    printStatus('fail', 'production readiness', `${failures} issue(s)`);
    return 1;
  }

  printStatus('ok', 'production readiness');
  return 0;
}

async function runInitSettings() {
  const context = createProductionContext();
  const updatedJson = buildProductionDeploySettingsInitJson({
    deploySettings: context.deploySettings,
    siteConfig: context.siteConfig,
    siteKey: context.siteKey,
  });
  const currentJson = readFileSync(context.deploySettingsPath, 'utf8');

  if (currentJson === updatedJson) {
    printStatus(
      'ok',
      'production deploy settings',
      `${relativePath(context.rootDir, context.deploySettingsPath)} already initialized`
    );
    return 0;
  }

  writeFileSync(context.deploySettingsPath, updatedJson, 'utf8');
  printStatus(
    'ok',
    'production deploy settings',
    relativePath(context.rootDir, context.deploySettingsPath)
  );
  return 0;
}

async function runProvision() {
  const context = createProductionContext();
  requireProductionOperatorValues(context);
  const env = createProductionCommandEnv(context);
  const resources = context.deploySettings.resources;

  await ensureR2Bucket(resources.appStorageBucket, env);
  if (context.hyperdriveRequired) {
    await ensureProductionHyperdrive(context, env);
  } else {
    printStatus('skip', 'Hyperdrive config', 'Hyperdrive disabled');
  }
  printStatus('ok', 'production resource provisioning');
  return 0;
}

async function main() {
  const mode = process.argv[2];
  if (!PRODUCTION_MODE_CHOICES.includes(mode)) {
    console.error(
      'Usage: SITE=<site-key> pnpm site:production:<doctor|init-settings|provision>'
    );
    process.exit(1);
  }

  const exitCode =
    mode === 'doctor'
      ? await runDoctor()
      : mode === 'init-settings'
        ? await runInitSettings()
        : await runProvision();
  process.exit(exitCode);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
