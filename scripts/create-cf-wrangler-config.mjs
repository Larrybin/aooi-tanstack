import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import topology from '../src/shared/config/cloudflare-worker-topology.ts';
import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';

const { CLOUDFLARE_ALL_SERVER_WORKER_TARGETS, CLOUDFLARE_VERSION_ID_VARS } =
  topology;
const rootDir = process.cwd();
const REQUIRED_INCREMENTAL_CACHE_BINDING = 'NEXT_INC_CACHE_R2_BUCKET';
const REQUIRED_APP_STORAGE_BINDING = 'APP_STORAGE_R2_BUCKET';
const REQUIRED_STATEFUL_LIMITERS_BINDING = 'STATEFUL_LIMITERS';
const REQUIRED_WORKERS_AI_BINDING = 'AI';
const REQUIRED_IMAGES_BINDING = 'IMAGES';
const REMOVER_CLEANUP_CRON = '17 3 * * *';
const STATE_TEMPLATE_NAME = 'wrangler.state.toml';
const PUBLIC_WEB_TEMPLATE_NAME = 'wrangler.server-public-web.toml';
const MANAGED_WORKER_VAR_KEYS = new Set([
  ...Object.values(CLOUDFLARE_VERSION_ID_VARS),
  ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map(
    (target) => topology.getServerWorkerMetadata(target).workerNameVar
  ),
]);

function readArrayTables(content, tableName) {
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
  return content.match(pattern)?.[1] ?? null;
}

function hasQuotedValue(content, pattern, expectedValue) {
  const match = content.match(pattern);
  return match?.[1] === expectedValue;
}

function escapeTomlBasicString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function replaceQuotedValue(content, pattern, nextValue, label) {
  if (!pattern.test(content)) {
    throw new Error(`missing ${label} in wrangler config template`);
  }

  return content.replace(pattern, `$1${escapeTomlBasicString(nextValue)}$3`);
}

function normalizeTomlPath(value) {
  return value.split(path.sep).join('/');
}

function rebaseRelativeTomlPath({
  content,
  pattern,
  label,
  templatePath,
  outputPath,
}) {
  const match = content.match(pattern);
  if (!match?.[2]) {
    throw new Error(`missing ${label} in wrangler config template`);
  }

  const currentPath = match[2];
  if (path.isAbsolute(currentPath)) {
    return content;
  }

  const rebasedPath = normalizeTomlPath(
    path.relative(
      path.dirname(outputPath),
      path.resolve(path.dirname(templatePath), currentPath)
    )
  );

  return content.replace(pattern, `$1${escapeTomlBasicString(rebasedPath)}$3`);
}

function upsertTomlTableStringValue(content, tableName, key, value) {
  const lines = content.split('\n');
  const tableHeader = `[${tableName}]`;
  const entryLine = `${key} = "${escapeTomlBasicString(value)}"`;
  const tableIndex = lines.findIndex((line) => line.trim() === tableHeader);

  if (tableIndex === -1) {
    if (lines.at(-1) !== '') {
      lines.push('');
    }

    lines.push(tableHeader, entryLine);
    return lines.join('\n');
  }

  let tableEndIndex = lines.length;
  for (let index = tableIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith('[')) {
      tableEndIndex = index;
      break;
    }
  }

  for (let index = tableIndex + 1; index < tableEndIndex; index += 1) {
    if (lines[index].trim().startsWith(`${key} = `)) {
      lines[index] = entryLine;
      return lines.join('\n');
    }
  }

  lines.splice(tableEndIndex, 0, entryLine);
  return lines.join('\n');
}

function upsertTopLevelBooleanValue(content, key, value) {
  const entryLine = `${key} = ${value ? 'true' : 'false'}`;
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(true|false)`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, entryLine);
  }

  const lines = content.split('\n');
  const firstTableIndex = lines.findIndex((line) =>
    line.trim().startsWith('[')
  );
  if (firstTableIndex === -1) {
    lines.push(entryLine);
    return lines.join('\n');
  }

  lines.splice(firstTableIndex, 0, entryLine);
  return lines.join('\n');
}

function replaceOrInsertArrayTable(content, tableName, rows) {
  const pattern = new RegExp(
    String.raw`\n?\[\[${tableName}\]\]\s*[\s\S]*?(?=\n\[\[|\n\[[^\[]|$)`,
    'g'
  );
  const cleaned = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');
  const block = rows
    .map((row) => {
      const entries = Object.entries(row)
        .map(([key, value]) => `${key} = "${escapeTomlBasicString(value)}"`)
        .join('\n');
      return `[[${tableName}]]\n${entries}`;
    })
    .join('\n\n');

  if (!block) {
    return cleaned;
  }

  return cleaned.trimEnd().concat('\n\n', block, '\n');
}

function replaceOrInsertDurableObjectBindings(content, bindings) {
  const pattern =
    /\n?\[\[durable_objects\.bindings\]\]\s*[\s\S]*?(?=\n\[\[|\n\[[^\[]|$)/g;
  const cleaned = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');
  const block = Object.entries(bindings)
    .map(
      ([name, binding]) =>
        `[[durable_objects.bindings]]\nname = "${escapeTomlBasicString(name)}"\nclass_name = "${escapeTomlBasicString(binding.className)}"${
          binding.scriptName
            ? `\nscript_name = "${escapeTomlBasicString(binding.scriptName)}"`
            : ''
        }`
    )
    .join('\n\n');

  return cleaned.trimEnd().concat('\n\n', block, '\n');
}

function replaceOrInsertMigrations(content, migrations) {
  const pattern = /\n?\[\[migrations\]\]\s*[\s\S]*?(?=\n\[\[|\n\[[^\[]|$)/g;
  const cleaned = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');

  if (!migrations) {
    return cleaned;
  }

  const classes = migrations.newSqliteClasses
    .map((className) => `  "${escapeTomlBasicString(className)}",`)
    .join('\n');
  const block = [
    '[[migrations]]',
    `tag = "${escapeTomlBasicString(migrations.tag)}"`,
    'new_sqlite_classes = [',
    classes,
    ']',
  ].join('\n');

  return cleaned.trimEnd().concat('\n\n', block, '\n');
}

function replaceOrInsertAiBinding(content, enabled) {
  const pattern = /\n?\[ai\]\s*[\s\S]*?(?=\n\[\[|\n\[[^\[]|$)/g;
  const cleaned = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');

  if (!enabled) {
    return cleaned;
  }

  return cleaned
    .trimEnd()
    .concat(
      `\n\n[ai]\nbinding = "${escapeTomlBasicString(REQUIRED_WORKERS_AI_BINDING)}"\n`
    );
}

function replaceOrInsertImagesBinding(content, enabled) {
  const pattern = /\n?\[images\]\s*[\s\S]*?(?=\n\[\[|\n\[[^\[]|$)/g;
  const cleaned = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');

  if (!enabled) {
    return cleaned;
  }

  return cleaned
    .trimEnd()
    .concat(
      `\n\n[images]\nbinding = "${escapeTomlBasicString(REQUIRED_IMAGES_BINDING)}"\n`
    );
}

function replaceOrInsertCronTriggers(content, crons) {
  const pattern = /\n?\[triggers\]\s*[\s\S]*?(?=\n\[\[|\n\[[^\[]|$)/g;
  const cleaned = content.replace(pattern, '').replace(/\n{3,}/g, '\n\n');

  if (crons.length === 0) {
    return cleaned;
  }

  const entries = crons
    .map((cron) => `"${escapeTomlBasicString(cron)}"`)
    .join(', ');
  return cleaned.trimEnd().concat(`\n\n[triggers]\ncrons = [${entries}]\n`);
}

function requiresRemoverCleanupCron(contract, workerSlot) {
  return (
    workerSlot === 'public-web' &&
    contract.bindingRequirements.secrets?.removerCleanup === true
  );
}

function assertTemplateContract(content, templatePath) {
  const label = path.relative(rootDir, templatePath) || templatePath;
  const r2Buckets = readArrayTables(content, 'r2_buckets');
  const doBindings = readArrayTables(content, 'durable_objects.bindings');
  const imagesSection = readSection(content, 'images');
  const isStateTemplate = path.basename(templatePath) === STATE_TEMPLATE_NAME;
  const isPublicWebTemplate =
    path.basename(templatePath) === PUBLIC_WEB_TEMPLATE_NAME;
  const isRouterTemplate =
    path.basename(templatePath) === 'wrangler.cloudflare.toml';

  if (!isStateTemplate) {
    if (
      !r2Buckets.some((table) =>
        hasQuotedValue(
          table,
          /^\s*binding\s*=\s*"([^"\n]+)"/m,
          REQUIRED_INCREMENTAL_CACHE_BINDING
        )
      )
    ) {
      throw new Error(
        `${label} must declare [[r2_buckets]] binding = "${REQUIRED_INCREMENTAL_CACHE_BINDING}"`
      );
    }

    if (
      !r2Buckets.some((table) =>
        hasQuotedValue(
          table,
          /^\s*binding\s*=\s*"([^"\n]+)"/m,
          REQUIRED_APP_STORAGE_BINDING
        )
      )
    ) {
      throw new Error(
        `${label} must declare [[r2_buckets]] binding = "${REQUIRED_APP_STORAGE_BINDING}"`
      );
    }
  }

  if (
    !doBindings.some((table) =>
      hasQuotedValue(
        table,
        /^\s*name\s*=\s*"([^"\n]+)"/m,
        REQUIRED_STATEFUL_LIMITERS_BINDING
      )
    )
  ) {
    throw new Error(
      `${label} must declare [[durable_objects.bindings]] name = "${REQUIRED_STATEFUL_LIMITERS_BINDING}"`
    );
  }

  if (
    !hasQuotedValue(
      content,
      /^\s*DEPLOY_TARGET\s*=\s*"([^"\n]+)"/m,
      'cloudflare'
    )
  ) {
    throw new Error(`${label} must pin DEPLOY_TARGET = "cloudflare"`);
  }

  if (imagesSection && !isRouterTemplate && !isPublicWebTemplate) {
    throw new Error(`${label} must not declare [images]`);
  }

  if (imagesSection) {
    if (
      !hasQuotedValue(
        imagesSection,
        /^\s*binding\s*=\s*"([^"\n]+)"/m,
        REQUIRED_IMAGES_BINDING
      )
    ) {
      throw new Error(`${label} must declare [images] binding = "IMAGES"`);
    }
  }
}

function resolveWorkerContract(contract, workerSlot) {
  if (workerSlot === 'router') {
    return contract.router;
  }

  if (workerSlot === 'state') {
    return contract.stateWorker;
  }

  const worker = contract.serverWorkers[workerSlot];
  if (!worker) {
    throw new Error(
      `Cloudflare worker "${workerSlot}" is disabled for SITE=${contract.siteKey}`
    );
  }
  return worker;
}

function applyWorkerSpecificBindings(content, contract, workerSlot) {
  let nextContent = content;
  const worker = resolveWorkerContract(contract, workerSlot);
  const requiresWorkersAi =
    workerSlot === 'public-web' &&
    contract.bindingRequirements.bindings?.workersAi === true;
  const cleanupCrons = requiresRemoverCleanupCron(contract, workerSlot)
    ? [REMOVER_CLEANUP_CRON]
    : [];

  nextContent = replaceQuotedValue(
    nextContent,
    /(^\s*name\s*=\s*")([^"\n]*)(")/m,
    worker.workerName,
    'name'
  );

  if (workerSlot === 'router') {
    nextContent =
      contract.route.mode === 'workers-dev'
        ? replaceOrInsertArrayTable(nextContent, 'routes', [])
        : replaceOrInsertArrayTable(nextContent, 'routes', [
            {
              pattern: contract.route.pattern,
              custom_domain: String(contract.route.customDomain),
            },
          ]).replace(/custom_domain = "true"/g, 'custom_domain = true');

    nextContent = replaceOrInsertArrayTable(
      nextContent,
      'services',
      Object.entries(contract.router.serviceBindings).map(
        ([binding, service]) => ({
          binding,
          service,
        })
      )
    );

    nextContent = replaceOrInsertDurableObjectBindings(
      nextContent,
      contract.router.durableObjects
    );
  } else if (workerSlot === 'state') {
    nextContent = replaceOrInsertArrayTable(nextContent, 'services', []);
    nextContent = replaceOrInsertDurableObjectBindings(
      nextContent,
      contract.stateWorker.durableObjects
    );
    nextContent = replaceOrInsertMigrations(
      nextContent,
      contract.stateWorker.migrations
    );
  } else {
    nextContent = replaceOrInsertArrayTable(
      nextContent,
      'services',
      workerSlot === 'admin'
        ? ['public-web', 'auth'].map((target) => {
            const serviceWorker = contract.serverWorkers[target];
            if (!serviceWorker) {
              throw new Error(
                `Cloudflare worker "admin" requires active "${target}" worker for SITE=${contract.siteKey}`
              );
            }
            return {
              binding: serviceWorker.serviceBinding,
              service: serviceWorker.workerName,
            };
          })
        : []
    );
    nextContent = replaceOrInsertDurableObjectBindings(
      nextContent,
      contract.router.durableObjects
    );
    nextContent = replaceOrInsertMigrations(nextContent, null);
  }

  if (workerSlot !== 'state') {
    nextContent = replaceOrInsertArrayTable(nextContent, 'r2_buckets', [
      {
        binding: REQUIRED_INCREMENTAL_CACHE_BINDING,
        bucket_name: contract.resources.incrementalCacheBucket,
      },
      {
        binding: REQUIRED_APP_STORAGE_BINDING,
        bucket_name: contract.resources.appStorageBucket,
      },
    ]);

    nextContent = replaceQuotedValue(
      nextContent,
      /(^\s*id\s*=\s*")([^"\n]*)(")/m,
      contract.resources.hyperdriveId,
      '[[hyperdrive]].id'
    );
  }

  nextContent = replaceOrInsertImagesBinding(
    nextContent,
    workerSlot === 'router' || workerSlot === 'public-web'
  );
  nextContent = replaceOrInsertAiBinding(nextContent, requiresWorkersAi);
  nextContent = replaceOrInsertCronTriggers(nextContent, cleanupCrons);
  nextContent = upsertTopLevelBooleanValue(
    nextContent,
    'workers_dev',
    workerSlot === 'router' && contract.route.mode === 'workers-dev'
  );
  nextContent = upsertTopLevelBooleanValue(
    nextContent,
    'preview_urls',
    workerSlot === 'router' && contract.route.mode === 'workers-dev'
  );

  return nextContent;
}

function replaceVars(content, vars) {
  let nextContent = content;

  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`(^\\s*${key}\\s*=\\s*")([^"\\n]*)(")`, 'm');
    nextContent = pattern.test(nextContent)
      ? replaceQuotedValue(nextContent, pattern, value, `vars.${key}`)
      : upsertTomlTableStringValue(nextContent, 'vars', key, value);
  }

  return nextContent;
}

function removeInactiveManagedVars(content, activeVars) {
  return content
    .split('\n')
    .filter((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
      return (
        !match ||
        !MANAGED_WORKER_VAR_KEYS.has(match[1]) ||
        match[1] in activeVars
      );
    })
    .join('\n');
}

/**
 * @param {{
 *   template: string,
 *   contract: any,
 *   workerSlot: string,
 *   databaseUrl?: string,
 *   appUrl?: string,
 *   storagePublicBaseUrl?: string,
 *   deployTarget?: string,
 *   devHost?: string,
 *   devUpstreamProtocol?: string,
 *   templatePath: string,
 *   outputPath: string,
 *   versionVars?: Record<string, string>,
 *   validateTemplateContract?: boolean,
 * }} options
 */
export function buildCloudflareWranglerConfig({
  template,
  contract,
  workerSlot,
  databaseUrl,
  appUrl,
  storagePublicBaseUrl,
  deployTarget,
  devHost,
  devUpstreamProtocol,
  templatePath,
  outputPath,
  versionVars = {},
  validateTemplateContract = false,
}) {
  if (
    validateTemplateContract &&
    existsSync(templatePath) &&
    path.resolve(templatePath).startsWith(`${rootDir}${path.sep}`)
  ) {
    assertTemplateContract(template, templatePath);
  }

  let nextContent = template;

  nextContent = applyWorkerSpecificBindings(nextContent, contract, workerSlot);

  const effectiveVars = {
    NEXT_PUBLIC_APP_URL: appUrl ?? contract.appUrl,
    APP_ENVIRONMENT:
      process.env.APP_ENVIRONMENT?.trim() ||
      (contract.deployProfile === 'preview' ? 'preview' : 'production'),
    ...(process.env.INTERNAL_ENTITLEMENT_GRANTS_ENABLED?.trim()
      ? {
          INTERNAL_ENTITLEMENT_GRANTS_ENABLED:
            process.env.INTERNAL_ENTITLEMENT_GRANTS_ENABLED.trim(),
        }
      : {}),
    STORAGE_PUBLIC_BASE_URL: storagePublicBaseUrl ?? '',
    DEPLOY_TARGET: deployTarget ?? 'cloudflare',
    ...(workerSlot === 'public-web' &&
    contract.bindingRequirements?.secrets?.turnstile
      ? {
          NEXT_PUBLIC_TURNSTILE_SITE_KEY:
            process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '',
        }
      : {}),
    ...(workerSlot === 'router' ? contract.router.versionVars : {}),
    ...(workerSlot === 'router' ? contract.router.workerNameVars : {}),
    ...versionVars,
  };

  if (databaseUrl !== undefined) {
    nextContent = replaceQuotedValue(
      nextContent,
      /(^\s*localConnectionString\s*=\s*")([^"\n]*)(")/m,
      databaseUrl,
      '[[hyperdrive]].localConnectionString'
    );
  }

  nextContent = replaceVars(nextContent, effectiveVars);
  nextContent = removeInactiveManagedVars(nextContent, effectiveVars);

  if (devHost !== undefined) {
    nextContent = upsertTomlTableStringValue(
      nextContent,
      'dev',
      'host',
      devHost
    );
  }

  if (devUpstreamProtocol !== undefined) {
    nextContent = upsertTomlTableStringValue(
      nextContent,
      'dev',
      'upstream_protocol',
      devUpstreamProtocol
    );
  }

  nextContent = rebaseRelativeTomlPath({
    content: nextContent,
    pattern: /(^\s*main\s*=\s*")([^"\n]*)(")/m,
    label: 'main',
    templatePath,
    outputPath,
  });

  if (/(^\s*directory\s*=\s*")([^"\n]*)(")/m.test(nextContent)) {
    nextContent = rebaseRelativeTomlPath({
      content: nextContent,
      pattern: /(^\s*directory\s*=\s*")([^"\n]*)(")/m,
      label: 'assets.directory',
      templatePath,
      outputPath,
    });
  }

  return nextContent;
}

function inferWorkerSlotFromTemplate(templatePath) {
  const relativeTemplatePath = path
    .relative(rootDir, templatePath)
    .replaceAll(path.sep, '/');

  if (relativeTemplatePath === 'wrangler.cloudflare.toml') {
    return 'router';
  }

  if (relativeTemplatePath === 'cloudflare/wrangler.state.toml') {
    return 'state';
  }

  const serverMatch = relativeTemplatePath.match(
    /^cloudflare\/wrangler\.server-(.+)\.toml$/
  );
  if (serverMatch?.[1]) {
    return serverMatch[1];
  }

  throw new Error(
    `cannot infer worker slot from template: ${relativeTemplatePath}`
  );
}

function parseArgs(argv) {
  const options = {
    out: path.resolve(rootDir, '.tmp/wrangler.cloudflare.generated.toml'),
    template: path.resolve(rootDir, 'wrangler.cloudflare.toml'),
    databaseUrl:
      process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
      process.env.DATABASE_URL?.trim(),
    appUrl: undefined,
    storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL?.trim(),
    deployTarget: process.env.DEPLOY_TARGET?.trim(),
    devHost: process.env.CF_LOCAL_DEV_HOST?.trim(),
    devUpstreamProtocol: process.env.CF_LOCAL_DEV_UPSTREAM_PROTOCOL?.trim(),
    versionVars: {},
    workerSlot: undefined,
    siteKey: resolveRequiredSiteKey(process.env),
  };

  for (const arg of argv) {
    if (arg.startsWith('--out=')) {
      options.out = path.resolve(rootDir, arg.split('=')[1]);
      continue;
    }

    if (arg.startsWith('--template=')) {
      options.template = path.resolve(rootDir, arg.split('=')[1]);
      continue;
    }

    if (arg.startsWith('--database-url=')) {
      options.databaseUrl = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--app-url=')) {
      options.appUrl = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--deploy-target=')) {
      options.deployTarget = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--storage-public-base-url=')) {
      options.storagePublicBaseUrl = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--dev-host=')) {
      options.devHost = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--dev-upstream-protocol=')) {
      options.devUpstreamProtocol = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--worker-slot=')) {
      options.workerSlot = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--site=')) {
      options.siteKey = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--var=')) {
      const raw = arg.slice('--var='.length);
      const separatorIndex = raw.indexOf('=');
      if (separatorIndex <= 0) {
        throw new Error(`invalid --var value: ${raw}`);
      }

      const key = raw.slice(0, separatorIndex);
      const value = raw.slice(separatorIndex + 1);
      options.versionVars[key] = value;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const template = await readFile(options.template, 'utf8');
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey: options.siteKey,
  });
  const workerSlot =
    options.workerSlot || inferWorkerSlotFromTemplate(options.template);
  const nextConfig = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot,
    databaseUrl: options.databaseUrl,
    appUrl: options.appUrl,
    storagePublicBaseUrl: options.storagePublicBaseUrl,
    deployTarget: options.deployTarget,
    devHost: options.devHost,
    devUpstreamProtocol: options.devUpstreamProtocol,
    templatePath: options.template,
    outputPath: options.out,
    versionVars: options.versionVars,
    validateTemplateContract: true,
  });

  await mkdir(path.dirname(options.out), { recursive: true });
  await writeFile(options.out, nextConfig, 'utf8');
  process.stdout.write(`${options.out}\n`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
