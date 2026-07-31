import type { SiteCloudflareContract } from './contract';

const ANALYTICS_KEYS = [
  'GOOGLE_ANALYTICS_ID',
  'CLARITY_ID',
  'PLAUSIBLE_DOMAIN',
  'OPENPANEL_CLIENT_ID',
] as const;

export type ReleaseStep =
  | 'db:migrate'
  | 'db:check'
  | 'cf:deploy:state'
  | 'cf:deploy:app';

export function hasAnalyticsProvider(
  env: Readonly<Record<string, string | undefined>>
) {
  return ANALYTICS_KEYS.some((key) => Boolean(env[key]?.trim()));
}

export function buildReleaseSteps(
  contract: SiteCloudflareContract
): ReleaseStep[] {
  return [
    ...(contract.requires.database
      ? (['db:migrate', 'db:check'] as const)
      : []),
    ...(contract.requires.state ? (['cf:deploy:state'] as const) : []),
    'cf:deploy:app',
  ];
}

export function assertReleaseEnvironment(
  contract: SiteCloudflareContract,
  env: NodeJS.ProcessEnv
) {
  const missing = [
    ...contract.requiredVars,
    ...contract.requiredSecrets,
  ].filter((name) => !env[name]?.trim());

  if (missing.length) {
    throw new Error(
      `SITE=${contract.siteKey} is missing required release values: ${missing.join(', ')}`
    );
  }

  if (
    contract.site.capabilities.enabledModules.includes('analytics') &&
    !hasAnalyticsProvider(env)
  ) {
    throw new Error(
      `SITE=${contract.siteKey} requires at least one Analytics provider before production deploy`
    );
  }
}
