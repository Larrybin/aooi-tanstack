import { readFileSync } from 'node:fs';
import path from 'node:path';

export const SITE_LOCAL_ENV_FILE = '.env.local';
const PREVIEW_DEPLOY_PROFILE = 'preview';
const WORKERS_DEV_SUBDOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/u;

type ReadFileSync = typeof readFileSync;

type SiteEnvOptions = {
  rootDir?: string;
  siteKey?: string;
  readFileSyncImpl?: ReadFileSync;
};

type SiteEnvOverlayOptions = SiteEnvOptions & {
  env?: NodeJS.ProcessEnv;
  originalEnv?: NodeJS.ProcessEnv;
};

function normalizeEnvValue(rawValue: string) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSiteEnvFileContent(content: string) {
  const entries: Record<string, string> = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const assignment = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const equalsIndex = assignment.indexOf('=');
    if (equalsIndex <= 0) continue;

    const name = assignment.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) continue;
    entries[name] = normalizeEnvValue(assignment.slice(equalsIndex + 1));
  }

  return entries;
}

export function resolveSiteLocalEnvPath({
  rootDir = process.cwd(),
  siteKey,
}: SiteEnvOptions = {}) {
  if (!siteKey?.trim()) return '';
  return path.join(rootDir, 'sites', siteKey.trim(), SITE_LOCAL_ENV_FILE);
}

export function readSiteLocalEnv({
  rootDir = process.cwd(),
  siteKey,
  readFileSyncImpl = readFileSync,
}: SiteEnvOptions = {}) {
  const envPath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  if (!envPath) return {};

  try {
    return parseSiteEnvFileContent(readFileSyncImpl(envPath, 'utf8'));
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return {};
    }
    throw error;
  }
}

function hasOwnEnvValue(env: NodeJS.ProcessEnv, name: string) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function getTrimmedEnvValue(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function buildPreviewStoragePublicBaseUrl(
  siteKey: string | undefined,
  env: NodeJS.ProcessEnv
) {
  const subdomain = getTrimmedEnvValue(env, 'CF_WORKERS_DEV_SUBDOMAIN');
  if (!siteKey?.trim() || !WORKERS_DEV_SUBDOMAIN_PATTERN.test(subdomain)) {
    return '';
  }
  return `https://aooi-${siteKey.trim()}-preview-router.${subdomain}.workers.dev/assets/`;
}

function applySiteProfileEnvMappings({
  env,
  originalEnv,
  siteKey,
}: Required<Pick<SiteEnvOverlayOptions, 'env' | 'originalEnv'>> & {
  siteKey?: string;
}) {
  const isPreviewProfile =
    getTrimmedEnvValue(env, 'CF_DEPLOY_PROFILE') === PREVIEW_DEPLOY_PROFILE;

  if (isPreviewProfile) {
    if (!hasOwnEnvValue(originalEnv, 'DATABASE_URL')) {
      const value = getTrimmedEnvValue(env, 'PREVIEW_DATABASE_URL');
      if (value) env.DATABASE_URL = value;
    }
    if (!hasOwnEnvValue(originalEnv, 'STORAGE_PUBLIC_BASE_URL')) {
      const value = buildPreviewStoragePublicBaseUrl(siteKey, env);
      if (value) env.STORAGE_PUBLIC_BASE_URL = value;
    }
    return env;
  }

  if (
    getTrimmedEnvValue(env, 'NODE_ENV') === 'production' &&
    !hasOwnEnvValue(originalEnv, 'DATABASE_URL')
  ) {
    const value = getTrimmedEnvValue(env, 'PRODUCTION_DATABASE_URL');
    if (value) env.DATABASE_URL = value;
  }
  if (
    getTrimmedEnvValue(env, 'NODE_ENV') === 'production' &&
    !hasOwnEnvValue(originalEnv, 'STORAGE_PUBLIC_BASE_URL')
  ) {
    const value = getTrimmedEnvValue(env, 'PRODUCTION_STORAGE_PUBLIC_BASE_URL');
    if (value) env.STORAGE_PUBLIC_BASE_URL = value;
  }

  return env;
}

export function applySiteLocalEnvOverlay({
  env = process.env,
  originalEnv = env,
  rootDir = process.cwd(),
  siteKey = env.SITE,
  readFileSyncImpl = readFileSync,
}: SiteEnvOverlayOptions = {}) {
  const entries = readSiteLocalEnv({ rootDir, siteKey, readFileSyncImpl });
  for (const [name, value] of Object.entries(entries)) {
    if (name === 'SITE' || hasOwnEnvValue(originalEnv, name)) continue;
    env[name] = value;
  }
  return applySiteProfileEnvMappings({ env, originalEnv, siteKey });
}
