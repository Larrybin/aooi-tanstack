const { readFileSync } = require('node:fs');
const path = require('node:path');

const SITE_LOCAL_ENV_FILE = '.env.local';
const PREVIEW_DEPLOY_PROFILE = 'preview';
const WORKERS_DEV_SUBDOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/u;

function normalizeEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseSiteEnvFileContent(content) {
  const entries = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const assignment = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trim()
      : trimmed;
    const equalsIndex = assignment.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const name = assignment.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) {
      continue;
    }

    entries[name] = normalizeEnvValue(assignment.slice(equalsIndex + 1));
  }

  return entries;
}

function resolveSiteLocalEnvPath({ rootDir = process.cwd(), siteKey }) {
  if (!siteKey?.trim()) {
    return '';
  }

  return path.join(rootDir, 'sites', siteKey.trim(), SITE_LOCAL_ENV_FILE);
}

function readSiteLocalEnv({
  rootDir = process.cwd(),
  siteKey,
  readFileSyncImpl = readFileSync,
} = {}) {
  const envPath = resolveSiteLocalEnvPath({ rootDir, siteKey });
  if (!envPath) {
    return {};
  }

  try {
    return parseSiteEnvFileContent(readFileSyncImpl(envPath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

function hasOwnEnvValue(env, name) {
  return Object.prototype.hasOwnProperty.call(env, name);
}

function getTrimmedEnvValue(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function hasShellEnvKey(originalEnv, name) {
  return hasOwnEnvValue(originalEnv, name);
}

function buildPreviewStoragePublicBaseUrl(siteKey, env) {
  const subdomain = getTrimmedEnvValue(env, 'CF_WORKERS_DEV_SUBDOMAIN');
  if (!siteKey?.trim() || !WORKERS_DEV_SUBDOMAIN_PATTERN.test(subdomain)) {
    return '';
  }

  return `https://aooi-${siteKey.trim()}-preview-router.${subdomain}.workers.dev/assets/`;
}

function applySiteProfileEnvMappings({ env, originalEnv, siteKey }) {
  const isPreviewProfile =
    getTrimmedEnvValue(env, 'CF_DEPLOY_PROFILE') === PREVIEW_DEPLOY_PROFILE;

  if (isPreviewProfile) {
    if (!hasShellEnvKey(originalEnv, 'DATABASE_URL')) {
      const previewDatabaseUrl = getTrimmedEnvValue(
        env,
        'PREVIEW_DATABASE_URL'
      );
      if (previewDatabaseUrl) {
        env.DATABASE_URL = previewDatabaseUrl;
      }
    }

    if (!hasShellEnvKey(originalEnv, 'STORAGE_PUBLIC_BASE_URL')) {
      const previewStoragePublicBaseUrl = buildPreviewStoragePublicBaseUrl(
        siteKey,
        env
      );
      if (previewStoragePublicBaseUrl) {
        env.STORAGE_PUBLIC_BASE_URL = previewStoragePublicBaseUrl;
      }
    }

    return env;
  }

  if (
    getTrimmedEnvValue(env, 'NODE_ENV') === 'production' &&
    !hasShellEnvKey(originalEnv, 'DATABASE_URL')
  ) {
    const productionDatabaseUrl = getTrimmedEnvValue(
      env,
      'PRODUCTION_DATABASE_URL'
    );
    if (productionDatabaseUrl) {
      env.DATABASE_URL = productionDatabaseUrl;
    }
  }

  if (
    getTrimmedEnvValue(env, 'NODE_ENV') === 'production' &&
    !hasShellEnvKey(originalEnv, 'STORAGE_PUBLIC_BASE_URL')
  ) {
    const productionStoragePublicBaseUrl = getTrimmedEnvValue(
      env,
      'PRODUCTION_STORAGE_PUBLIC_BASE_URL'
    );
    if (productionStoragePublicBaseUrl) {
      env.STORAGE_PUBLIC_BASE_URL = productionStoragePublicBaseUrl;
    }
  }

  return env;
}

function applySiteLocalEnvOverlay({
  env = process.env,
  originalEnv = env,
  rootDir = process.cwd(),
  siteKey = env.SITE,
  readFileSyncImpl = readFileSync,
} = {}) {
  const entries = readSiteLocalEnv({
    rootDir,
    siteKey,
    readFileSyncImpl,
  });

  for (const [name, value] of Object.entries(entries)) {
    if (name === 'SITE') {
      continue;
    }

    if (hasOwnEnvValue(originalEnv, name)) {
      continue;
    }

    env[name] = value;
  }

  return applySiteProfileEnvMappings({ env, originalEnv, siteKey });
}

module.exports = {
  SITE_LOCAL_ENV_FILE,
  applySiteLocalEnvOverlay,
  parseSiteEnvFileContent,
  readSiteLocalEnv,
  resolveSiteLocalEnvPath,
};
