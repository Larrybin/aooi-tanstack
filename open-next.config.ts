import {
  defineCloudflareConfig,
  type OpenNextConfig,
} from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue';
import doShardedTagCache from '@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache';

import {
  CLOUDFLARE_SPLIT_WORKER_TARGETS,
  getSplitWorker,
  type CloudflareSplitWorkerTarget,
} from './src/shared/config/cloudflare-worker-splits';

const ACTIVE_SPLIT_WORKERS_ENV = 'CLOUDFLARE_ACTIVE_SPLIT_WORKERS';
const splitWorkerSet = new Set<string>(CLOUDFLARE_SPLIT_WORKER_TARGETS);

const baseConfig = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: doShardedTagCache(),
  queue: doQueue,
});

function resolveActiveSplitWorkerTargets() {
  const rawValue = process.env[ACTIVE_SPLIT_WORKERS_ENV]?.trim();
  if (!rawValue) {
    return [...CLOUDFLARE_SPLIT_WORKER_TARGETS];
  }

  const targets = rawValue
    .split(',')
    .map((target) => target.trim())
    .filter(Boolean);
  const unknownTargets = targets.filter(
    (target) => !splitWorkerSet.has(target)
  );
  if (unknownTargets.length > 0) {
    throw new Error(
      `${ACTIVE_SPLIT_WORKERS_ENV} contains unknown split worker(s): ${unknownTargets.join(', ')}`
    );
  }

  return targets as CloudflareSplitWorkerTarget[];
}

export function buildOpenNextConfig({
  activeSplitWorkerTargets = resolveActiveSplitWorkerTargets(),
}: {
  activeSplitWorkerTargets?: readonly CloudflareSplitWorkerTarget[];
} = {}) {
  return {
    ...baseConfig,
    default: {
      ...baseConfig.default,
      placement: 'regional',
      runtime: 'node',
    },
    functions: Object.fromEntries(
      activeSplitWorkerTargets.map((target) => {
        const split = getSplitWorker(target);

        return [
          target,
          {
            ...baseConfig.default,
            placement: 'regional',
            runtime: 'node',
            routes: [...split.routeTemplates],
            patterns: [...split.patterns],
          },
        ];
      })
    ),
    middleware:
      baseConfig.middleware && 'external' in baseConfig.middleware
        ? {
            ...baseConfig.middleware,
            originResolver: 'pattern-env',
          }
        : baseConfig.middleware,
  } as OpenNextConfig;
}

const config = buildOpenNextConfig();

export default config;
