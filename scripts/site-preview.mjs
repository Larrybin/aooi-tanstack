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
  runPnpmInherit,
  runWrangler,
  stripAnsi,
  withCommandPathFallback,
} from './lib/cloudflare-provisioning.mjs';
import {
  readCurrentSiteConfig,
  resolveRequiredSiteKey,
} from './lib/site-config.mjs';
import {
  buildPreviewBucketName,
  buildPreviewRouterOrigin,
  buildPreviewWorkerName,
} from './lib/site-deploy-profile.mjs';
import {
  DEPLOY_SETTINGS_CONFIG_VERSION,
  readSiteDeploySettings,
  resolveSitePreviewDeploySettingsPath,
  validateSitePreviewDeploySettings,
} from './lib/site-deploy-settings.mjs';

const { applySiteLocalEnvOverlay, readSiteLocalEnv, resolveSiteLocalEnvPath } =
  siteEnvModule;

const PREVIEW_MODE_CHOICES = ['doctor', 'provision', 'deploy'];

function trimEnvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function relativePath(rootDir, targetPath) {
  return path.relative(rootDir, targetPath) || '.';
}

export function buildPreviewResourceNames(siteKey, processEnv = process.env) {
  return {
    cacheBucket: buildPreviewBucketName(siteKey, 'opennext-cache'),
    routerOrigin: buildPreviewRouterOrigin(siteKey, processEnv),
    routerWorker: buildPreviewWorkerName(siteKey, 'router'),
    storageBucket: buildPreviewBucketName(siteKey, 'storage'),
  };
}

export function buildPreviewDeploySettingsJson(hyperdriveId) {
  if (!isValidHyperdriveId(hyperdriveId)) {
    throw new Error(
      'preview Hyperdrive id must be a 32-character lowercase hex value'
    );
  }

  return `${JSON.stringify(
    {
      configVersion: DEPLOY_SETTINGS_CONFIG_VERSION,
      resources: {
        hyperdriveId,
      },
    },
    null,
    2
  )}\n`;
}

export function buildPreviewCommandOriginalEnv(processEnv, siteKey) {
  return {
    ...processEnv,
    CF_DEPLOY_PROFILE: 'preview',
    SITE: siteKey,
  };
}

export function assertPreviewSettingsCanProvision(context) {
  if (context.previewSettings.state !== 'invalid') {
    return;
  }

  throw new Error(
    `invalid ${relativePath(context.rootDir, context.previewSettings.filePath)}: ${context.previewSettings.error}`
  );
}

function readPreviewDeploySettingsStatus({ rootDir, siteKey }) {
  const filePath = resolveSitePreviewDeploySettingsPath({ rootDir, siteKey });
  if (!existsSync(filePath)) {
    return {
      filePath,
      hyperdriveId: '',
      state: 'missing',
    };
  }

  try {
    const config = JSON.parse(readFileSync(filePath, 'utf8'));
    validateSitePreviewDeploySettings(config);
    return {
      filePath,
      hyperdriveId: config.resources.hyperdriveId,
      state: 'valid',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      filePath,
      hyperdriveId: '',
      state: 'invalid',
    };
  }
}

function createPreviewCommandEnv({
  rootDir,
  siteKey,
  processEnv = process.env,
}) {
  const originalEnv = buildPreviewCommandOriginalEnv(processEnv, siteKey);
  const env = { ...originalEnv };

  applySiteLocalEnvOverlay({
    env,
    originalEnv,
    rootDir,
    siteKey,
  });

  return withCommandPathFallback(env, processEnv);
}

function resolveOperatorValue({ envFileValues, name, processEnv }) {
  if (hasOwnEnvValue(processEnv, name)) {
    return trimEnvValue(processEnv[name]);
  }

  return trimEnvValue(envFileValues[name]);
}

function createPreviewContext({
  processEnv = process.env,
  rootDir = process.cwd(),
} = {}) {
  const siteKey = resolveRequiredSiteKey(processEnv);
  readCurrentSiteConfig({ rootDir, siteKey });
  readSiteDeploySettings({ rootDir, siteKey });

  const envFilePath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  const envFileValues = readSiteLocalEnv({ rootDir, siteKey });
  const workersDevSubdomain = resolveOperatorValue({
    envFileValues,
    name: 'CF_WORKERS_DEV_SUBDOMAIN',
    processEnv,
  });
  const previewDatabaseUrl = resolveOperatorValue({
    envFileValues,
    name: 'PREVIEW_DATABASE_URL',
    processEnv,
  });
  const resourceEnv = {
    ...processEnv,
    CF_WORKERS_DEV_SUBDOMAIN: workersDevSubdomain,
  };
  const resourceNames = workersDevSubdomain
    ? buildPreviewResourceNames(siteKey, resourceEnv)
    : {
        cacheBucket: buildPreviewBucketName(siteKey, 'opennext-cache'),
        routerOrigin: '',
        routerWorker: buildPreviewWorkerName(siteKey, 'router'),
        storageBucket: buildPreviewBucketName(siteKey, 'storage'),
      };

  return {
    envFilePath,
    envFileValues,
    previewDatabaseUrl,
    previewSettings: readPreviewDeploySettingsStatus({ rootDir, siteKey }),
    resourceNames,
    rootDir,
    siteKey,
    workersDevSubdomain,
  };
}

function requirePreviewOperatorValues(context) {
  const missing = [];
  if (!context.workersDevSubdomain) {
    missing.push('CF_WORKERS_DEV_SUBDOMAIN');
  }
  if (!context.previewDatabaseUrl) {
    missing.push('PREVIEW_DATABASE_URL');
  }

  if (missing.length > 0) {
    throw new Error(
      `missing required preview value(s) in sites/${context.siteKey}/.env.local or shell: ${missing.join(
        ', '
      )}`
    );
  }
}

async function runDoctor() {
  const context = createPreviewContext();
  const env = createPreviewCommandEnv(context);
  let failures = 0;

  printStatus('ok', 'site', context.siteKey);
  printStatus(
    'ok',
    'deploy settings',
    `sites/${context.siteKey}/deploy.settings.json`
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

  if (context.workersDevSubdomain) {
    printStatus('ok', 'CF_WORKERS_DEV_SUBDOMAIN');
  } else {
    failures += 1;
    printStatus('missing', 'CF_WORKERS_DEV_SUBDOMAIN');
  }

  if (context.previewDatabaseUrl) {
    printStatus('ok', 'PREVIEW_DATABASE_URL');
  } else {
    failures += 1;
    printStatus('missing', 'PREVIEW_DATABASE_URL');
  }

  if (context.previewSettings.state === 'valid') {
    printStatus(
      'ok',
      'preview deploy settings',
      relativePath(context.rootDir, context.previewSettings.filePath)
    );
  } else {
    failures += 1;
    printStatus(
      context.previewSettings.state,
      'preview deploy settings',
      context.previewSettings.error ||
        `create ${relativePath(context.rootDir, context.previewSettings.filePath)}`
    );
  }

  if (context.resourceNames.routerOrigin) {
    printStatus('ok', 'preview URL', context.resourceNames.routerOrigin);
  }

  if (context.workersDevSubdomain) {
    for (const bucketName of [
      context.resourceNames.cacheBucket,
      context.resourceNames.storageBucket,
    ]) {
      try {
        if (await checkR2Bucket(bucketName, env)) {
          printStatus('ok', 'R2 bucket', bucketName);
        } else {
          failures += 1;
          printStatus('missing', 'R2 bucket', bucketName);
        }
      } catch (error) {
        failures += 1;
        printStatus(
          'error',
          'R2 bucket check',
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  if (context.previewSettings.state === 'valid') {
    if (await checkHyperdrive(context.previewSettings.hyperdriveId, env)) {
      printStatus(
        'ok',
        'Hyperdrive config',
        context.previewSettings.hyperdriveId
      );
    } else {
      failures += 1;
      printStatus(
        'missing',
        'Hyperdrive config',
        context.previewSettings.hyperdriveId
      );
    }
  }

  try {
    if (await checkWorker(context.resourceNames.routerWorker, env)) {
      printStatus(
        'ok',
        'preview router worker',
        context.resourceNames.routerWorker
      );
    } else {
      failures += 1;
      printStatus(
        'missing',
        'preview router worker',
        context.resourceNames.routerWorker
      );
    }
  } catch (error) {
    failures += 1;
    printStatus(
      'error',
      'preview router worker check',
      error instanceof Error ? error.message : String(error)
    );
  }

  if (failures > 0) {
    printStatus('fail', 'preview readiness', `${failures} issue(s)`);
    return 1;
  }

  printStatus('ok', 'preview readiness');
  return 0;
}

async function runProvision() {
  const context = createPreviewContext();
  requirePreviewOperatorValues(context);
  assertPreviewSettingsCanProvision(context);

  const env = createPreviewCommandEnv(context);

  await ensureR2Bucket(context.resourceNames.cacheBucket, env);
  await ensureR2Bucket(context.resourceNames.storageBucket, env);

  if (context.previewSettings.state === 'valid') {
    if (!(await checkHyperdrive(context.previewSettings.hyperdriveId, env))) {
      throw new Error(
        `preview Hyperdrive id is configured but not accessible: ${context.previewSettings.hyperdriveId}`
      );
    }

    printStatus(
      'ok',
      'Hyperdrive config',
      context.previewSettings.hyperdriveId
    );
    return 0;
  }

  printStatus(
    'create',
    'Hyperdrive config',
    `aooi-${context.siteKey}-preview-db`
  );
  const result = await runWrangler(
    [
      'hyperdrive',
      'create',
      `aooi-${context.siteKey}-preview-db`,
      '--connection-string',
      context.previewDatabaseUrl,
      '--sslmode',
      'require',
    ],
    env
  );
  assertWranglerSuccess('create Hyperdrive config', result, [
    context.previewDatabaseUrl,
  ]);

  const hyperdriveId = parseHyperdriveIdFromOutput(result.output);
  if (!hyperdriveId) {
    const output = redactValues(stripAnsi(result.output).trim(), [
      context.previewDatabaseUrl,
    ]);
    throw new Error(
      `created Hyperdrive config but could not read its id from Wrangler output${output ? `:\n${output}` : ''}`
    );
  }

  writeFileSync(
    context.previewSettings.filePath,
    buildPreviewDeploySettingsJson(hyperdriveId),
    'utf8'
  );
  printStatus(
    'ok',
    'preview deploy settings',
    relativePath(context.rootDir, context.previewSettings.filePath)
  );
  printStatus('ok', 'Hyperdrive config', hyperdriveId);
  return 0;
}

async function runDeploy() {
  const context = createPreviewContext();
  requirePreviewOperatorValues(context);
  if (context.previewSettings.state !== 'valid') {
    throw new Error(
      `valid sites/${context.siteKey}/deploy.preview.settings.json is required before preview deploy`
    );
  }

  const env = createPreviewCommandEnv(context);
  const steps = [
    ['migrate preview database', ['db:migrate']],
    ['check preview config', ['cf:preview:check']],
    ['build preview workers', ['cf:preview:build']],
    ['deploy preview state worker', ['cf:preview:deploy:state']],
    ['bootstrap preview app workers', ['cf:preview:bootstrap']],
  ];

  for (const [label, args] of steps) {
    printStatus('run', label, `pnpm ${args.join(' ')}`);
    const code = await runPnpmInherit(args, env);
    if (code !== 0) {
      throw new Error(`${label} failed with exit code ${code}`);
    }
  }

  printStatus('ok', 'preview URL', context.resourceNames.routerOrigin);
  return 0;
}

async function main() {
  const mode = process.argv[2];
  if (!PREVIEW_MODE_CHOICES.includes(mode)) {
    console.error(
      `Usage: SITE=<site-key> pnpm site:preview:<doctor|provision|deploy>`
    );
    process.exit(1);
  }

  const exitCode =
    mode === 'doctor'
      ? await runDoctor()
      : mode === 'provision'
        ? await runProvision()
        : await runDeploy();
  process.exit(exitCode);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
