import fs from 'node:fs';
import path from 'node:path';

import topology from '../src/shared/config/cloudflare-worker-topology.ts';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import {
  getRequiredRuntimeBindingsByWorker,
  resolveCloudflareWorkerKeys,
} from './lib/cloudflare-runtime-bindings.mjs';
import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import {
  resolveAllSiteDeployContracts,
  resolveSiteDeployContract,
} from './lib/site-deploy-contract.mjs';
import { resolveCloudflareDeployProfile } from './lib/site-deploy-profile.mjs';

const {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_DURABLE_OBJECT_BINDINGS,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_VERSION_ID_VARS,
  getServerWorkerMetadata,
} = topology;

const rootDir = process.cwd();
const forbiddenIdentityEnvName = ['NEXT_PUBLIC', 'APP', 'NAME'].join('_');
const configuredStoragePublicBaseUrl =
  process.env.STORAGE_PUBLIC_BASE_URL?.trim() || '';

function fail(message) {
  console.error(`[cf:check] ${message}`);
  process.exit(1);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`missing ${path.relative(rootDir, filePath)}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function readQuotedValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match?.[1]?.trim()) {
    fail(`missing ${label}`);
  }

  return match[1].trim();
}

function readMaybeEmptyQuotedValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match) {
    fail(`missing ${label}`);
  }

  return match[1] ?? '';
}

function readBooleanValue(content, label, pattern) {
  const match = content.match(pattern);
  if (!match?.[1]?.trim()) {
    fail(`missing ${label}`);
  }

  return match[1].trim();
}

function readArrayTable(content, tableName) {
  const pattern = new RegExp(
    String.raw`\[\[${tableName}\]\]\s*([\s\S]*?)(?=\n\[\[|\n\[|$)`,
    'g'
  );

  return Array.from(content.matchAll(pattern), (match) => match[1]);
}

function readSection(content, sectionName) {
  const pattern = new RegExp(
    String.raw`\[${sectionName}\]\s*([\s\S]*?)(?=\n\[\[|\n\[|$)`
  );
  const match = content.match(pattern);
  if (!match?.[1]) {
    fail(`missing [${sectionName}] section`);
  }

  return match[1];
}

function readOptionalSection(content, sectionName) {
  const pattern = new RegExp(
    String.raw`\[${sectionName}\]\s*([\s\S]*?)(?=\n\[\[|\n\[|$)`
  );
  const match = content.match(pattern);
  return match?.[1] ?? null;
}

function normalizeOrigin(value, label) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      fail(`${label} must use http/https`);
    }
    return url.origin;
  } catch (error) {
    fail(`${label} must be a valid URL (${String(error)})`);
  }
}

function normalizeTomlPath(value) {
  return value.split(path.sep).join('/');
}

function readExpectedRebasedMain(templatePath, workerEntryRelativePath) {
  return normalizeTomlPath(
    path.relative(
      path.resolve(rootDir, '.tmp'),
      path.resolve(rootDir, workerEntryRelativePath)
    )
  );
}

function parseWorkerKeys(args) {
  const workersArg = args.find((arg) => arg.startsWith('--workers='));
  try {
    return resolveCloudflareWorkerKeys(
      workersArg ? workersArg.split('=')[1] : 'all'
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

function readFlags(content) {
  const match = content.match(/^\s*compatibility_flags\s*=\s*\[(.+?)\]/m);
  if (!match?.[1]) {
    fail('missing compatibility_flags');
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (flag) => flag[1]).sort();
}

function assertRequiredRuntimeBindings(
  label,
  workerKey,
  requiredBindingsByWorker
) {
  const requirements = requiredBindingsByWorker.get(workerKey) || [];
  for (const requirement of requirements) {
    const names = requirement.names ?? [requirement.name];
    const value = names.find(
      (name) => (process.env[name]?.trim() || '').length > 0
    );
    const allowPreviewPlaceholderSecret =
      requirement.kind === 'runtime-secret' &&
      resolveCloudflareDeployProfile(process.env) === 'preview' &&
      process.env.CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS?.trim() === 'true';
    if (!value && allowPreviewPlaceholderSecret) {
      continue;
    }
    if (!value) {
      const displayName = names.join(' or ');
      const site = process.env.SITE?.trim() || 'unknown';
      const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
      const deployTarget = process.env.DEPLOY_TARGET?.trim() || 'cloudflare';
      const workerScope =
        process.argv
          .find((arg) => arg.startsWith('--workers='))
          ?.split('=')[1] || 'all';
      fail(
        `${label} requires runtime binding ${displayName} because worker ${requirement.worker} runs ${requirement.capability}; runtime settings do not control deploy requirements (SITE=${site} NODE_ENV=${nodeEnv} DEPLOY_TARGET=${deployTarget} workers=${workerScope})`
      );
    }
  }
}

function assertSharedSettings(content, label, options = {}) {
  const {
    requiresAssets = true,
    requiresR2Buckets = true,
    requiresHyperdrive = true,
    requiresStoragePublicBaseUrl = true,
    requiresWorkersAi = false,
    expectedWorkersDev = false,
    expectedPreviewUrls = false,
    expectedAppOrigin,
    expectedIncrementalCacheBucket,
    expectedAppStorageBucket,
  } = options;

  const compatibilityDate = readQuotedValue(
    content,
    `${label}.compatibility_date`,
    /^\s*compatibility_date\s*=\s*"([^"\n]+)"/m
  );
  const workersDev = readBooleanValue(
    content,
    `${label}.workers_dev`,
    /^\s*workers_dev\s*=\s*(true|false)/m
  );
  const previewUrls = readBooleanValue(
    content,
    `${label}.preview_urls`,
    /^\s*preview_urls\s*=\s*(true|false)/m
  );
  const flags = readFlags(content);

  if (compatibilityDate !== '2025-03-01') {
    fail(`${label}.compatibility_date must equal 2025-03-01`);
  }

  if (workersDev !== String(expectedWorkersDev)) {
    fail(`${label}.workers_dev must be ${String(expectedWorkersDev)}`);
  }

  if (previewUrls !== String(expectedPreviewUrls)) {
    fail(`${label}.preview_urls must be ${String(expectedPreviewUrls)}`);
  }

  const expectedFlags = ['global_fetch_strictly_public', 'nodejs_compat'];
  if (JSON.stringify(flags) !== JSON.stringify(expectedFlags)) {
    fail(`${label}.compatibility_flags must equal ${expectedFlags.join(', ')}`);
  }

  const observabilitySection = readSection(content, 'observability');
  const observabilityEnabled = readBooleanValue(
    observabilitySection,
    `${label}.observability.enabled`,
    /^\s*enabled\s*=\s*(true|false)/m
  );
  if (observabilityEnabled !== 'true') {
    fail(`${label}.observability.enabled must be true`);
  }

  const assetsSection = readOptionalSection(content, 'assets');
  if (requiresAssets) {
    if (!assetsSection) {
      fail(`missing [assets] section`);
    }

    const assetsBinding = readQuotedValue(
      assetsSection,
      `${label}.assets.binding`,
      /^\s*binding\s*=\s*"([^"\n]+)"/m
    );
    if (assetsBinding !== 'ASSETS') {
      fail(`${label}.assets.binding must equal ASSETS`);
    }
  } else if (assetsSection) {
    fail(`${label} must not define [assets]`);
  }

  const r2BucketTables = readArrayTable(content, 'r2_buckets');
  if (requiresR2Buckets) {
    const incrementalCacheBucket = r2BucketTables.find((table) =>
      /^\s*binding\s*=\s*"NEXT_INC_CACHE_R2_BUCKET"/m.test(table)
    );
    if (!incrementalCacheBucket) {
      fail(
        `${label} missing [[r2_buckets]] binding = "NEXT_INC_CACHE_R2_BUCKET"`
      );
    }
    const incrementalBucketName = readQuotedValue(
      incrementalCacheBucket,
      `${label}.r2_buckets.NEXT_INC_CACHE_R2_BUCKET.bucket_name`,
      /^\s*bucket_name\s*=\s*"([^"\n]+)"/m
    );
    if (incrementalBucketName !== expectedIncrementalCacheBucket) {
      fail(
        `${label}.NEXT_INC_CACHE_R2_BUCKET bucket_name must equal ${expectedIncrementalCacheBucket}`
      );
    }

    const appStorageBucket = r2BucketTables.find((table) =>
      /^\s*binding\s*=\s*"APP_STORAGE_R2_BUCKET"/m.test(table)
    );
    if (!appStorageBucket) {
      fail(`${label} missing [[r2_buckets]] binding = "APP_STORAGE_R2_BUCKET"`);
    }
    const appStorageBucketName = readQuotedValue(
      appStorageBucket,
      `${label}.r2_buckets.APP_STORAGE_R2_BUCKET.bucket_name`,
      /^\s*bucket_name\s*=\s*"([^"\n]+)"/m
    );
    if (appStorageBucketName !== expectedAppStorageBucket) {
      fail(
        `${label}.APP_STORAGE_R2_BUCKET bucket_name must equal ${expectedAppStorageBucket}`
      );
    }
  } else if (r2BucketTables.length > 0) {
    fail(`${label} must not define [[r2_buckets]]`);
  }

  const hyperdriveTables = readArrayTable(content, 'hyperdrive');
  if (requiresHyperdrive) {
    const hyperdrive = hyperdriveTables.find((table) =>
      /^\s*binding\s*=\s*"HYPERDRIVE"/m.test(table)
    );
    if (!hyperdrive) {
      fail(`${label} missing [[hyperdrive]] binding = "HYPERDRIVE"`);
    }

    const localConnectionString = readMaybeEmptyQuotedValue(
      hyperdrive,
      `${label}.hyperdrive.localConnectionString`,
      /^\s*localConnectionString\s*=\s*"([^"\n]*)"/m
    );
    if (localConnectionString !== '') {
      fail(
        `${label}.hyperdrive.localConnectionString must be empty in tracked templates`
      );
    }
  } else if (hyperdriveTables.length > 0) {
    fail(`${label} must not define [[hyperdrive]]`);
  }

  const aiSection = readOptionalSection(content, 'ai');
  if (requiresWorkersAi) {
    if (!aiSection) {
      fail(`${label} missing [ai] binding = "AI"`);
    }

    const aiBinding = readQuotedValue(
      aiSection,
      `${label}.ai.binding`,
      /^\s*binding\s*=\s*"([^"\n]+)"/m
    );
    if (aiBinding !== 'AI') {
      fail(`${label}.ai.binding must equal AI`);
    }
  } else if (aiSection) {
    fail(`${label} must not define [ai]`);
  }

  const varsSection = readSection(content, 'vars');
  const deployTarget = readQuotedValue(
    varsSection,
    `${label}.vars.DEPLOY_TARGET`,
    /^\s*DEPLOY_TARGET\s*=\s*"([^"\n]+)"/m
  );
  const appUrl = readQuotedValue(
    varsSection,
    `${label}.vars.NEXT_PUBLIC_APP_URL`,
    /^\s*NEXT_PUBLIC_APP_URL\s*=\s*"([^"\n]+)"/m
  );

  if (deployTarget !== 'cloudflare') {
    fail(`${label}.vars.DEPLOY_TARGET must equal cloudflare`);
  }

  if (
    normalizeOrigin(appUrl, `${label}.vars.NEXT_PUBLIC_APP_URL`) !==
    expectedAppOrigin
  ) {
    fail(
      `${label}.vars.NEXT_PUBLIC_APP_URL must share the same origin as the deploy contract app origin (${expectedAppOrigin})`
    );
  }

  if (
    new RegExp(String.raw`^\s*${forbiddenIdentityEnvName}\s*=`, 'm').test(
      varsSection
    )
  ) {
    fail(
      `${label}.vars.${forbiddenIdentityEnvName} is forbidden; site identity must come from @/site`
    );
  }

  if (requiresStoragePublicBaseUrl) {
    const trackedStoragePublicBaseUrl = readMaybeEmptyQuotedValue(
      varsSection,
      `${label}.vars.STORAGE_PUBLIC_BASE_URL`,
      /^\s*STORAGE_PUBLIC_BASE_URL\s*=\s*"([^"\n]*)"/m
    );
    const effectiveStoragePublicBaseUrl =
      configuredStoragePublicBaseUrl || trackedStoragePublicBaseUrl.trim();
    if (!effectiveStoragePublicBaseUrl) {
      fail(
        `${label}.vars.STORAGE_PUBLIC_BASE_URL is required as the R2 public asset base URL; it is a runtime binding and must not come from settings/public-config`
      );
    }

    normalizeOrigin(
      effectiveStoragePublicBaseUrl,
      `${label}.vars.STORAGE_PUBLIC_BASE_URL`
    );
  }
}

function buildEffectiveWorkerConfig(contract, workerKey) {
  const worker =
    workerKey === 'router'
      ? contract.router
      : workerKey === 'state'
        ? contract.stateWorker
        : contract.serverWorkers[workerKey];
  const templatePath = path.resolve(rootDir, worker.wranglerConfigRelativePath);
  const template = readFile(templatePath);

  return buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: workerKey,
    storagePublicBaseUrl: configuredStoragePublicBaseUrl,
    templatePath,
    outputPath: path.resolve(rootDir, '.tmp', `cf-check-${workerKey}.toml`),
    validateTemplateContract: true,
  });
}

function assertRouterConfig(content, contract, requiredBindingsByWorker) {
  assertSharedSettings(content, 'router', {
    expectedWorkersDev: contract.route.mode === 'workers-dev',
    expectedPreviewUrls: contract.route.mode === 'workers-dev',
    expectedAppOrigin: contract.appOrigin,
    expectedIncrementalCacheBucket: contract.resources.incrementalCacheBucket,
    expectedAppStorageBucket: contract.resources.appStorageBucket,
  });
  assertRequiredRuntimeBindings('router', 'router', requiredBindingsByWorker);

  const workerName = readQuotedValue(
    content,
    'router.name',
    /^\s*name\s*=\s*"([^"\n]+)"/m
  );
  const main = readQuotedValue(
    content,
    'router.main',
    /^\s*main\s*=\s*"([^"\n]+)"/m
  );
  const expectedMain = readExpectedRebasedMain(
    path.resolve(rootDir, contract.router.wranglerConfigRelativePath),
    contract.router.workerEntryRelativePath
  );

  if (workerName !== contract.router.workerName) {
    fail(`router.name must equal ${contract.router.workerName}`);
  }

  if (main !== expectedMain) {
    fail(`router.main must equal ${expectedMain}`);
  }

  const imagesSection = readSection(content, 'images');
  const imagesBinding = readQuotedValue(
    imagesSection,
    'router.images.binding',
    /^\s*binding\s*=\s*"([^"\n]+)"/m
  );
  if (imagesBinding !== 'IMAGES') {
    fail('router.images.binding must equal IMAGES');
  }

  const serviceTables = readArrayTable(content, 'services');
  const expectedServices = new Map([
    ['WORKER_SELF_REFERENCE', contract.router.workerName],
    ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
      CLOUDFLARE_SERVICE_BINDINGS[target],
      contract.serverWorkers[target].workerName,
    ]),
  ]);

  const routeTables = readArrayTable(content, 'routes');
  if (contract.route.mode === 'workers-dev') {
    if (routeTables.length > 0) {
      fail('preview router must not define [[routes]]');
    }
  } else {
    if (routeTables.length !== 1) {
      fail('router must define exactly one [[routes]] table');
    }
    const routePattern = readQuotedValue(
      routeTables[0],
      'router.routes.pattern',
      /^\s*pattern\s*=\s*"([^"\n]+)"/m
    );
    const routeCustomDomain = readBooleanValue(
      routeTables[0],
      'router.routes.custom_domain',
      /^\s*custom_domain\s*=\s*(true|false)/m
    );

    if (routePattern !== contract.site.domain) {
      fail(
        `router.routes.pattern must equal site.domain (${contract.site.domain})`
      );
    }

    if (routeCustomDomain !== String(contract.route.customDomain)) {
      fail(
        `router.routes.custom_domain must equal ${String(contract.route.customDomain)}`
      );
    }
  }

  for (const [binding, expectedService] of expectedServices) {
    const table = serviceTables.find((entry) =>
      new RegExp(`^\\s*binding\\s*=\\s*"${binding}"`, 'm').test(entry)
    );
    if (!table) {
      fail(`router missing [[services]] binding = "${binding}"`);
    }

    const service = readQuotedValue(
      table,
      `router.services.${binding}.service`,
      /^\s*service\s*=\s*"([^"\n]+)"/m
    );
    if (service !== expectedService) {
      fail(`router.services.${binding}.service must equal ${expectedService}`);
    }
  }

  const varsSection = readSection(content, 'vars');
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    readMaybeEmptyQuotedValue(
      varsSection,
      `router.vars.${CLOUDFLARE_VERSION_ID_VARS[target]}`,
      new RegExp(
        String.raw`^\s*${CLOUDFLARE_VERSION_ID_VARS[target]}\s*=\s*"([^"\n]*)"`,
        'm'
      )
    );

    const workerNameVar = getServerWorkerMetadata(target).workerNameVar;
    const workerNameValue = readMaybeEmptyQuotedValue(
      varsSection,
      `router.vars.${workerNameVar}`,
      new RegExp(String.raw`^\s*${workerNameVar}\s*=\s*"([^"\n]*)"`, 'm')
    );
    if (workerNameValue !== contract.serverWorkers[target].workerName) {
      fail(
        `router.vars.${workerNameVar} must equal ${contract.serverWorkers[target].workerName}`
      );
    }
  }

  const doTables = readArrayTable(content, 'durable_objects.bindings');
  for (const [bindingName, className] of Object.entries(
    CLOUDFLARE_DURABLE_OBJECT_BINDINGS
  )) {
    const table = doTables.find((entry) =>
      new RegExp(`^\\s*name\\s*=\\s*"${bindingName}"`, 'm').test(entry)
    );
    if (!table) {
      fail(
        `router missing [[durable_objects.bindings]] name = "${bindingName}"`
      );
    }

    const actualClassName = readQuotedValue(
      table,
      `router.durable_objects.${bindingName}.class_name`,
      /^\s*class_name\s*=\s*"([^"\n]+)"/m
    );
    if (actualClassName !== className) {
      fail(
        `router.durable_objects.${bindingName}.class_name must equal ${className}`
      );
    }

    const scriptName = readQuotedValue(
      table,
      `router.durable_objects.${bindingName}.script_name`,
      /^\s*script_name\s*=\s*"([^"\n]+)"/m
    );
    if (scriptName !== contract.stateWorker.workerName) {
      fail(
        `router.durable_objects.${bindingName}.script_name must equal ${contract.stateWorker.workerName}`
      );
    }
  }

  const migrationTables = readArrayTable(content, 'migrations');
  if (migrationTables.length > 0) {
    fail('router must not define [[migrations]]');
  }
}

function assertStateConfig(content, contract, requiredBindingsByWorker) {
  assertSharedSettings(content, 'state', {
    requiresAssets: false,
    requiresR2Buckets: false,
    requiresHyperdrive: false,
    requiresStoragePublicBaseUrl: false,
    expectedAppOrigin: contract.appOrigin,
  });
  assertRequiredRuntimeBindings('state', 'state', requiredBindingsByWorker);

  const workerName = readQuotedValue(
    content,
    'state.name',
    /^\s*name\s*=\s*"([^"\n]+)"/m
  );
  const main = readQuotedValue(
    content,
    'state.main',
    /^\s*main\s*=\s*"([^"\n]+)"/m
  );
  const expectedMain = readExpectedRebasedMain(
    path.resolve(rootDir, contract.stateWorker.wranglerConfigRelativePath),
    contract.stateWorker.workerEntryRelativePath
  );

  if (workerName !== contract.stateWorker.workerName) {
    fail(`state.name must equal ${contract.stateWorker.workerName}`);
  }

  if (main !== expectedMain) {
    fail(`state.main must equal ${expectedMain}`);
  }

  const doTables = readArrayTable(content, 'durable_objects.bindings');
  for (const [bindingName, className] of Object.entries(
    CLOUDFLARE_DURABLE_OBJECT_BINDINGS
  )) {
    const table = doTables.find((entry) =>
      new RegExp(`^\\s*name\\s*=\\s*"${bindingName}"`, 'm').test(entry)
    );
    if (!table) {
      fail(
        `state missing [[durable_objects.bindings]] name = "${bindingName}"`
      );
    }

    const actualClassName = readQuotedValue(
      table,
      `state.durable_objects.${bindingName}.class_name`,
      /^\s*class_name\s*=\s*"([^"\n]+)"/m
    );
    if (actualClassName !== className) {
      fail(
        `state.durable_objects.${bindingName}.class_name must equal ${className}`
      );
    }
  }

  const migrationTables = readArrayTable(content, 'migrations');
  if (migrationTables.length === 0) {
    fail('state missing [[migrations]] as the Durable Object owner');
  }

  const migrationTag = readQuotedValue(
    migrationTables[0],
    'state.migrations.tag',
    /^\s*tag\s*=\s*"([^"\n]+)"/m
  );
  if (migrationTag !== contract.stateWorker.migrations.tag) {
    fail(
      `state.migrations.tag must equal ${contract.stateWorker.migrations.tag}`
    );
  }
}

function assertServerConfig(
  content,
  contract,
  target,
  requiredBindingsByWorker
) {
  assertSharedSettings(content, `${target}`, {
    expectedAppOrigin: contract.appOrigin,
    expectedIncrementalCacheBucket: contract.resources.incrementalCacheBucket,
    expectedAppStorageBucket: contract.resources.appStorageBucket,
    requiresWorkersAi:
      target === 'public-web' &&
      contract.bindingRequirements.bindings?.workersAi === true,
  });
  assertRequiredRuntimeBindings(`${target}`, target, requiredBindingsByWorker);

  const workerName = readQuotedValue(
    content,
    `${target}.name`,
    /^\s*name\s*=\s*"([^"\n]+)"/m
  );
  const main = readQuotedValue(
    content,
    `${target}.main`,
    /^\s*main\s*=\s*"([^"\n]+)"/m
  );
  const expectedMain = readExpectedRebasedMain(
    path.resolve(
      rootDir,
      contract.serverWorkers[target].wranglerConfigRelativePath
    ),
    getServerWorkerMetadata(target).workerEntryRelativePath
  );

  if (workerName !== contract.serverWorkers[target].workerName) {
    fail(
      `${target}.name must equal ${contract.serverWorkers[target].workerName}`
    );
  }

  if (main !== expectedMain) {
    fail(`${target}.main must equal ${expectedMain}`);
  }

  if (/^\s*\[\[routes\]\]/m.test(content)) {
    fail(`${target} must not define [[routes]]`);
  }

  const serviceTables = readArrayTable(content, 'services');
  const expectedServices =
    target === 'admin'
      ? new Map(
          ['public-web', 'auth'].map((serviceTarget) => [
            CLOUDFLARE_SERVICE_BINDINGS[serviceTarget],
            contract.serverWorkers[serviceTarget].workerName,
          ])
        )
      : new Map();

  if (serviceTables.length !== expectedServices.size) {
    fail(
      expectedServices.size > 0
        ? `${target} must define exactly ${expectedServices.size} [[services]] bindings`
        : `${target} must not define [[services]]`
    );
  }

  for (const [binding, expectedService] of expectedServices) {
    const table = serviceTables.find((entry) =>
      new RegExp(`^\\s*binding\\s*=\\s*"${binding}"`, 'm').test(entry)
    );
    if (!table) {
      fail(`${target} missing [[services]] binding = "${binding}"`);
    }

    const service = readQuotedValue(
      table,
      `${target}.services.${binding}.service`,
      /^\s*service\s*=\s*"([^"\n]+)"/m
    );
    if (service !== expectedService) {
      fail(
        `${target}.services.${binding}.service must equal ${expectedService}`
      );
    }
  }

  const imagesSection = readOptionalSection(content, 'images');
  if (target === 'public-web') {
    if (!imagesSection) {
      fail(`${target} missing [images] binding = "IMAGES"`);
    }
    const imagesBinding = readQuotedValue(
      imagesSection,
      `${target}.images.binding`,
      /^\s*binding\s*=\s*"([^"\n]+)"/m
    );
    if (imagesBinding !== 'IMAGES') {
      fail(`${target}.images.binding must equal IMAGES`);
    }
  } else if (imagesSection) {
    fail(`${target} must not define [images]`);
  }

  const triggersSection = readOptionalSection(content, 'triggers');
  const requiresRemoverCleanup =
    target === 'public-web' &&
    contract.bindingRequirements.secrets?.removerCleanup === true;
  if (requiresRemoverCleanup) {
    if (!triggersSection) {
      fail(`${target} missing [triggers] cleanup cron`);
    }
    if (
      !/^\s*crons\s*=\s*\[[^\]]*"17 3 \* \* \*"[^\]]*\]/m.test(triggersSection)
    ) {
      fail(`${target}.triggers.crons must include AI Remover cleanup cron`);
    }
  } else if (triggersSection) {
    fail(`${target} must not define [triggers]`);
  }

  const doTables = readArrayTable(content, 'durable_objects.bindings');
  for (const [bindingName, className] of Object.entries(
    CLOUDFLARE_DURABLE_OBJECT_BINDINGS
  )) {
    const table = doTables.find((entry) =>
      new RegExp(`^\\s*name\\s*=\\s*"${bindingName}"`, 'm').test(entry)
    );
    if (!table) {
      fail(
        `${target} missing [[durable_objects.bindings]] name = "${bindingName}"`
      );
    }

    const actualClassName = readQuotedValue(
      table,
      `${target}.durable_objects.${bindingName}.class_name`,
      /^\s*class_name\s*=\s*"([^"\n]+)"/m
    );
    if (actualClassName !== className) {
      fail(
        `${target}.durable_objects.${bindingName}.class_name must equal ${className}`
      );
    }

    const scriptName = readQuotedValue(
      table,
      `${target}.durable_objects.${bindingName}.script_name`,
      /^\s*script_name\s*=\s*"([^"\n]+)"/m
    );
    if (scriptName !== contract.stateWorker.workerName) {
      fail(
        `${target}.durable_objects.${bindingName}.script_name must equal ${contract.stateWorker.workerName}`
      );
    }
  }

  const migrationTables = readArrayTable(content, 'migrations');
  if (migrationTables.length > 0) {
    fail(
      `${target} must not define [[migrations]] because only state owns Durable Objects`
    );
  }
}

function main() {
  const workerKeys = parseWorkerKeys(process.argv.slice(2));
  try {
    resolveAllSiteDeployContracts({ rootDir });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: resolveRequiredSiteKey(process.env),
  });
  const requiredBindingsByWorker = getRequiredRuntimeBindingsByWorker(
    contract.bindingRequirements
  );

  if (
    contract.route.mode === 'custom-domain' &&
    contract.route.pattern !== contract.site.domain
  ) {
    fail(
      `site domain and router route pattern must match exactly: ${contract.site.domain} vs ${contract.route.pattern}`
    );
  }

  for (const workerKey of workerKeys) {
    const content = buildEffectiveWorkerConfig(contract, workerKey);

    if (workerKey === 'router') {
      assertRouterConfig(content, contract, requiredBindingsByWorker);
      continue;
    }

    if (workerKey === 'state') {
      assertStateConfig(content, contract, requiredBindingsByWorker);
      continue;
    }

    assertServerConfig(content, contract, workerKey, requiredBindingsByWorker);
  }

  console.log(
    `[cf:check] Cloudflare config structure looks good for workers: ${workerKeys.join(', ')}`
  );
}

main();
