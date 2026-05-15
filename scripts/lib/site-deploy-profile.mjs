export const CLOUDFLARE_DEPLOY_PROFILES = Object.freeze([
  'production',
  'preview',
]);

const WORKERS_DEV_SUBDOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function resolveCloudflareDeployProfile(processEnv = process.env) {
  const profile = processEnv.CF_DEPLOY_PROFILE?.trim() || 'production';
  if (!CLOUDFLARE_DEPLOY_PROFILES.includes(profile)) {
    throw new Error(
      `CF_DEPLOY_PROFILE must be one of: ${CLOUDFLARE_DEPLOY_PROFILES.join(', ')}`
    );
  }

  return profile;
}

export function isPreviewDeployProfile(processEnv = process.env) {
  return resolveCloudflareDeployProfile(processEnv) === 'preview';
}

export function resolveWorkersDevSubdomain(processEnv = process.env) {
  const subdomain = processEnv.CF_WORKERS_DEV_SUBDOMAIN?.trim();
  if (!subdomain) {
    throw new Error(
      'CF_WORKERS_DEV_SUBDOMAIN is required when CF_DEPLOY_PROFILE=preview'
    );
  }

  if (!WORKERS_DEV_SUBDOMAIN_PATTERN.test(subdomain)) {
    throw new Error(
      'CF_WORKERS_DEV_SUBDOMAIN must be a valid workers.dev account subdomain'
    );
  }

  return subdomain;
}

export function buildPreviewWorkerName(siteKey, slot) {
  return `aooi-${siteKey}-preview-${slot}`;
}

export function buildPreviewBucketName(siteKey, suffix) {
  return `aooi-${siteKey}-preview-${suffix}`;
}

export function buildPreviewRouterOrigin(siteKey, processEnv = process.env) {
  return `https://${buildPreviewWorkerName(
    siteKey,
    'router'
  )}.${resolveWorkersDevSubdomain(processEnv)}.workers.dev`;
}
