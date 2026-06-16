export const CLOUDFLARE_DURABLE_OBJECT_BINDINGS = {
  NEXT_CACHE_DO_QUEUE: 'DOQueueHandler',
  NEXT_TAG_CACHE_DO_SHARDED: 'DOShardedTagCache',
  STATEFUL_LIMITERS: 'StatefulLimitersDurableObject',
} as const;

export const CLOUDFLARE_SERVICE_BINDINGS = {
  'public-web': 'PUBLIC_WEB_WORKER',
  auth: 'AUTH_WORKER',
  payment: 'PAYMENT_WORKER',
  member: 'MEMBER_WORKER',
  chat: 'CHAT_WORKER',
  admin: 'ADMIN_WORKER',
} as const;

export const CLOUDFLARE_VERSION_ID_VARS = {
  'public-web': 'PUBLIC_WEB_WORKER_VERSION_ID',
  auth: 'AUTH_WORKER_VERSION_ID',
  payment: 'PAYMENT_WORKER_VERSION_ID',
  member: 'MEMBER_WORKER_VERSION_ID',
  chat: 'CHAT_WORKER_VERSION_ID',
  admin: 'ADMIN_WORKER_VERSION_ID',
} as const;

export const CLOUDFLARE_LOCAL_WORKER_URL_VARS = {
  'public-web': 'CF_LOCAL_PUBLIC_WEB_WORKER_URL',
  auth: 'CF_LOCAL_AUTH_WORKER_URL',
  payment: 'CF_LOCAL_PAYMENT_WORKER_URL',
  member: 'CF_LOCAL_MEMBER_WORKER_URL',
  chat: 'CF_LOCAL_CHAT_WORKER_URL',
  admin: 'CF_LOCAL_ADMIN_WORKER_URL',
} as const;

export const CLOUDFLARE_SPLIT_WORKER_TARGETS = [
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
] as const;

export const CLOUDFLARE_ALL_SERVER_WORKER_TARGETS = [
  'public-web',
  ...CLOUDFLARE_SPLIT_WORKER_TARGETS,
] as const;

export const AUTH_UI_WORKER_TARGETS = ['public-web'] as const;
export const AUTH_HANDLER_WORKER_TARGETS = ['auth'] as const;

export type CloudflareSplitWorkerTarget =
  (typeof CLOUDFLARE_SPLIT_WORKER_TARGETS)[number];

export type CloudflareServerWorkerTarget =
  (typeof CLOUDFLARE_ALL_SERVER_WORKER_TARGETS)[number];

export type ServerWorkerMetadata = {
  readonly serviceBinding: string;
  readonly versionIdVar: string;
  readonly workerNameVar: string;
  readonly bundleEntryRelativePath: string;
  readonly workerEntryRelativePath: string;
  readonly wranglerConfigRelativePath: string;
};

export const CLOUDFLARE_ROUTER_WORKER = {
  workerEntryRelativePath: 'cloudflare/workers/router.ts',
  wranglerConfigRelativePath: 'wrangler.cloudflare.toml',
} as const;

export const CLOUDFLARE_STATE_WORKER = {
  workerEntryRelativePath: 'cloudflare/workers/state.ts',
  wranglerConfigRelativePath: 'cloudflare/wrangler.state.toml',
} as const;

export const SERVER_WORKER_METADATA: Record<
  CloudflareServerWorkerTarget,
  ServerWorkerMetadata
> = {
  'public-web': {
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS['public-web'],
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS['public-web'],
    workerNameVar: 'PUBLIC_WEB_WORKER_NAME',
    bundleEntryRelativePath: 'dist/server/server.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-public-web.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-public-web.toml',
  },
  auth: {
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.auth,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.auth,
    workerNameVar: 'AUTH_WORKER_NAME',
    bundleEntryRelativePath: 'dist/server/server.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-auth.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-auth.toml',
  },
  payment: {
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.payment,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.payment,
    workerNameVar: 'PAYMENT_WORKER_NAME',
    bundleEntryRelativePath: 'dist/server/server.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-payment.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-payment.toml',
  },
  member: {
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.member,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.member,
    workerNameVar: 'MEMBER_WORKER_NAME',
    bundleEntryRelativePath: 'dist/server/server.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-member.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-member.toml',
  },
  chat: {
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.chat,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.chat,
    workerNameVar: 'CHAT_WORKER_NAME',
    bundleEntryRelativePath: 'dist/server/server.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-chat.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-chat.toml',
  },
  admin: {
    serviceBinding: CLOUDFLARE_SERVICE_BINDINGS.admin,
    versionIdVar: CLOUDFLARE_VERSION_ID_VARS.admin,
    workerNameVar: 'ADMIN_WORKER_NAME',
    bundleEntryRelativePath: 'dist/server/server.mjs',
    workerEntryRelativePath: 'cloudflare/workers/server-admin.ts',
    wranglerConfigRelativePath: 'cloudflare/wrangler.server-admin.toml',
  },
};

export function getServerWorkerMetadata(target: CloudflareServerWorkerTarget) {
  return SERVER_WORKER_METADATA[target];
}

export function getDeclaredServerWorkerTargets(env: Record<string, unknown>) {
  return CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.filter((target) => {
    const workerName = env[SERVER_WORKER_METADATA[target].workerNameVar];
    return typeof workerName === 'string' && workerName.trim() !== '';
  });
}

export function buildVersionOverridesHeader(
  env: Record<string, string | undefined>,
  targets: readonly CloudflareServerWorkerTarget[] = CLOUDFLARE_ALL_SERVER_WORKER_TARGETS
) {
  const entries = targets
    .map((target) => {
      const metadata = SERVER_WORKER_METADATA[target];
      const versionId = env[metadata.versionIdVar]?.trim();
      const workerName = env[metadata.workerNameVar]?.trim();

      if (!versionId || !workerName) {
        return null;
      }

      return `${workerName}="${versionId}"`;
    })
    .filter((value): value is string => value !== null);

  return entries.length === 0 ? null : entries.join(', ');
}

const cloudflareWorkerTopology = {
  CLOUDFLARE_DURABLE_OBJECT_BINDINGS,
  CLOUDFLARE_ROUTER_WORKER,
  CLOUDFLARE_STATE_WORKER,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_VERSION_ID_VARS,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  AUTH_UI_WORKER_TARGETS,
  AUTH_HANDLER_WORKER_TARGETS,
  getServerWorkerMetadata,
  getDeclaredServerWorkerTargets,
  buildVersionOverridesHeader,
};

export default cloudflareWorkerTopology;
