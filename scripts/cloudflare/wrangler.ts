import path from 'node:path';

import type { SiteCloudflareContract } from './contract';

type WranglerBuildOptions = {
  rootDir?: string;
  configPath: string;
  processEnv?: NodeJS.ProcessEnv;
  appEntryPath?: string;
};

function tomlString(value: string) {
  return JSON.stringify(value);
}

function relativeFromConfig(configPath: string, targetPath: string) {
  const value = path
    .relative(path.dirname(configPath), targetPath)
    .split(path.sep)
    .join('/');
  return value.startsWith('.') ? value : `./${value}`;
}

function appUrl(contract: SiteCloudflareContract) {
  return contract.site.brand.appUrl;
}

function buildBase({
  contract,
  configPath,
  entryPath,
}: {
  contract: SiteCloudflareContract;
  configPath: string;
  entryPath: string;
}) {
  return [
    `name = ${tomlString(contract.workers.app)}`,
    `main = ${tomlString(relativeFromConfig(configPath, entryPath))}`,
    'compatibility_date = "2025-03-01"',
    'compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]',
    'workers_dev = false',
    'preview_urls = false',
    '',
  ];
}

export function buildAppWranglerConfig(
  contract: SiteCloudflareContract,
  {
    rootDir = process.cwd(),
    configPath,
    processEnv = process.env,
    appEntryPath = path.resolve(rootDir, 'cloudflare/workers/app.ts'),
  }: WranglerBuildOptions
) {
  const lines = buildBase({
    contract,
    configPath,
    entryPath: appEntryPath,
  });

  lines.push(
    '[alias]',
    `"@/site" = ${tomlString(
      relativeFromConfig(
        configPath,
        path.resolve(
          rootDir,
          '.generated',
          'sites',
          contract.siteKey,
          'site.ts'
        )
      )
    )}`,
    '',
    '[[routes]]',
    `pattern = ${tomlString(contract.site.domain)}`,
    'custom_domain = true',
    '',
    '[assets]',
    'binding = "ASSETS"',
    `directory = ${tomlString(relativeFromConfig(configPath, path.resolve(rootDir, 'dist', contract.siteKey, 'client')))}`,
    '',
    '[images]',
    'binding = "IMAGES"',
    ''
  );

  if (contract.requires.r2) {
    lines.push(
      '[[r2_buckets]]',
      'binding = "APP_STORAGE_R2_BUCKET"',
      `bucket_name = ${tomlString(contract.resources.appStorageBucket!)}`,
      ''
    );
  }
  if (contract.requires.database) {
    lines.push(
      '[[hyperdrive]]',
      'binding = "HYPERDRIVE"',
      `id = ${tomlString(contract.resources.hyperdriveId!)}`,
      'localConnectionString = ""',
      ''
    );
  }
  if (contract.requires.workersAi) {
    lines.push('[ai]', 'binding = "AI"', '');
  }
  if (contract.requires.state) {
    lines.push(
      '[[durable_objects.bindings]]',
      'name = "STATEFUL_LIMITERS"',
      'class_name = "StatefulLimitersDurableObject"',
      `script_name = ${tomlString(contract.workers.state!)}`,
      ''
    );
  }
  if (contract.requiredSecrets.includes('REMOVER_CLEANUP_SECRET')) {
    lines.push('[triggers]', 'crons = ["17 3 * * *"]', '');
  }

  lines.push('[observability]', 'enabled = true', '', '[vars]');
  const vars: Record<string, string> = {
    APP_ENVIRONMENT: 'production',
    DATABASE_PROVIDER: 'postgresql',
    DEPLOY_TARGET: 'cloudflare',
    NEXT_PUBLIC_APP_URL: appUrl(contract),
    NEXT_PUBLIC_THEME: 'default',
    GOOGLE_ANALYTICS_ID: processEnv.GOOGLE_ANALYTICS_ID?.trim() ?? '',
    CLARITY_ID: processEnv.CLARITY_ID?.trim() ?? '',
    PLAUSIBLE_DOMAIN: processEnv.PLAUSIBLE_DOMAIN?.trim() ?? '',
    PLAUSIBLE_SRC: processEnv.PLAUSIBLE_SRC?.trim() ?? '',
    OPENPANEL_CLIENT_ID: processEnv.OPENPANEL_CLIENT_ID?.trim() ?? '',
  };
  if (contract.requires.database) vars.DB_SINGLETON_ENABLED = 'true';
  for (const name of contract.requiredVars) {
    vars[name] = processEnv[name]?.trim() ?? '';
  }
  for (const [name, value] of Object.entries(vars).sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    lines.push(`${name} = ${tomlString(value)}`);
  }
  lines.push('');

  return lines.join('\n');
}

export function buildStateWranglerConfig(
  contract: SiteCloudflareContract,
  { rootDir = process.cwd(), configPath }: WranglerBuildOptions
) {
  if (!contract.requires.state || !contract.workers.state) {
    throw new Error(`SITE=${contract.siteKey} does not require a state worker`);
  }

  const lines = [
    `name = ${tomlString(contract.workers.state)}`,
    `main = ${tomlString(
      relativeFromConfig(
        configPath,
        path.resolve(rootDir, 'cloudflare/workers/state.ts')
      )
    )}`,
    'compatibility_date = "2025-03-01"',
    'compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]',
    'workers_dev = false',
    'preview_urls = false',
    '',
    '[[durable_objects.bindings]]',
    'name = "STATEFUL_LIMITERS"',
    'class_name = "StatefulLimitersDurableObject"',
    '',
    '[[migrations]]',
    `tag = ${tomlString(`${contract.workers.state}-v1`)}`,
    'new_sqlite_classes = ["StatefulLimitersDurableObject"]',
    '',
    '[observability]',
    'enabled = true',
    '',
    '[vars]',
    'DEPLOY_TARGET = "cloudflare"',
    `NEXT_PUBLIC_APP_URL = ${tomlString(appUrl(contract))}`,
    '',
  ];

  return lines.join('\n');
}
