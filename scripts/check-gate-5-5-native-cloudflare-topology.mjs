import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const reportMode = args.has('--report');
for (const arg of args) {
  if (arg !== '--report') throw new Error(`unknown argument: ${arg}`);
}

const NATIVE_SERVER_ARTIFACT = 'dist/server/server.mjs';
const NATIVE_ASSETS_DIR = 'dist/client';
const SERVER_WORKER_TARGETS = [
  'public-web',
  'auth',
  'payment',
  'member',
  'chat',
  'admin',
];
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', '.next']);
const SCAN_ROOTS = [
  'cloudflare',
  'scripts',
  'src/shared/config',
  'src/shared/types/open-next-generated.d.ts',
  'src/infra/runtime/env.server.ts',
  'wrangler.cloudflare.toml',
  'vite.config.mts',
  'package.json',
];
const CHECKER_PATH = 'scripts/check-gate-5-5-native-cloudflare-topology.mjs';
const CONFIG_FILES = new Set([
  'wrangler.cloudflare.toml',
  'cloudflare/wrangler.server-admin.toml',
  'cloudflare/wrangler.server-auth.toml',
  'cloudflare/wrangler.server-chat.toml',
  'cloudflare/wrangler.server-member.toml',
  'cloudflare/wrangler.server-payment.toml',
  'cloudflare/wrangler.server-public-web.toml',
]);

function abs(repoPath) {
  return path.resolve(root, repoPath);
}

function toRepoPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function isIgnored(repoPath) {
  if (repoPath === CHECKER_PATH) return true;
  if (repoPath.startsWith('docs/')) return true;
  return repoPath.split('/').some((part) => IGNORED_DIRS.has(part));
}

function shouldScanFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (isIgnored(repoPath)) return false;
  return /\.(ts|tsx|mts|mjs|js|jsx|cjs|json|toml|d\.ts)$/.test(repoPath);
}

function walk(currentPath, out) {
  if (!existsSync(currentPath)) return;
  const stats = statSync(currentPath);
  if (stats.isFile()) {
    if (shouldScanFile(currentPath)) out.push(currentPath);
    return;
  }
  if (!stats.isDirectory()) return;
  const repoPath = toRepoPath(currentPath);
  if (isIgnored(repoPath)) return;
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    walk(path.join(currentPath, entry.name), out);
  }
}

function collectFiles() {
  const files = [];
  for (const scanRoot of SCAN_ROOTS) walk(abs(scanRoot), files);
  return files.sort((left, right) =>
    toRepoPath(left).localeCompare(toRepoPath(right))
  );
}

function classifyHit(repoPath, line, text) {
  const trimmed = text.trim();
  if (repoPath === 'package.json') {
    if (trimmed.includes('@opennextjs/cloudflare')) {
      return {
        classification: 'defer_gate_5_6_dependency',
        reason: 'OpenNext package removal belongs to Gate 5.6',
      };
    }
    return null;
  }

  if (
    repoPath.includes('check-gate-') ||
    repoPath.includes('tanstack-native-inventory') ||
    repoPath.includes('validate-tanstack-native-migration') ||
    repoPath.includes('tanstack-gate-4-plan') ||
    repoPath.includes('conventions-index')
  ) {
    return {
      classification: 'defer_gate_5_6_dependency',
      reason:
        'migration checker/inventory text is cleaned up in final deletion gate',
    };
  }

  if (CONFIG_FILES.has(repoPath) && trimmed.includes('.open-next')) {
    return {
      classification: 'active_config_blocker',
      reason: 'active Wrangler/config path still points to OpenNext artifacts',
    };
  }

  if (
    repoPath.startsWith('cloudflare/workers/') &&
    (trimmed.includes('.open-next') || trimmed.includes('@opennextjs'))
  ) {
    return {
      classification: 'active_blocker',
      reason:
        'active Cloudflare worker runtime still imports OpenNext artifacts',
    };
  }

  if (
    repoPath === 'scripts/lib/cloudflare-build-artifacts.mjs' ||
    repoPath === 'scripts/run-cf-multi-build-check.mjs' ||
    repoPath === 'scripts/bundle-cf-server-functions.mjs' ||
    repoPath === 'scripts/run-cf-build.mjs'
  ) {
    if (
      trimmed.includes('.open-next') ||
      trimmed.includes('opennextjs-cloudflare')
    ) {
      return {
        classification: 'active_blocker',
        reason: 'active build script still requires OpenNext artifacts',
      };
    }
  }

  if (
    repoPath === 'src/infra/runtime/env.server.ts' &&
    trimmed.includes('@opennextjs/cloudflare')
  ) {
    return {
      classification: 'active_blocker',
      reason: 'runtime env still depends on OpenNext Cloudflare context',
    };
  }

  if (repoPath === 'src/shared/types/open-next-generated.d.ts') {
    return {
      classification: 'defer_gate_5_6_dependency',
      reason:
        'OpenNext generated declarations are removed with final deletion gate',
    };
  }

  if (
    repoPath.includes('cloudflare-worker-topology') &&
    trimmed.includes('.open-next')
  ) {
    return {
      classification: 'active_config_blocker',
      reason:
        'active topology metadata still points to OpenNext server function artifacts',
    };
  }

  if (trimmed.includes('.open-next') || trimmed.includes('@opennextjs')) {
    return {
      classification: 'active_blocker',
      reason: 'unclassified active OpenNext residue',
    };
  }

  return null;
}

function collectHits() {
  const hits = [];
  for (const filePath of collectFiles()) {
    const repoPath = toRepoPath(filePath);
    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (
        !line.includes('.open-next') &&
        !line.includes('@opennextjs') &&
        !line.includes('opennextjs-cloudflare')
      )
        continue;
      const classification = classifyHit(repoPath, index + 1, line);
      if (classification)
        hits.push({
          repoPath,
          line: index + 1,
          text: line.trim(),
          ...classification,
        });
    }
  }
  return hits;
}

function hasNativeArtifactContract() {
  return {
    serverArtifactPresent: existsSync(abs(NATIVE_SERVER_ARTIFACT)),
    assetsDirPresent:
      existsSync(abs(NATIVE_ASSETS_DIR)) &&
      statSync(abs(NATIVE_ASSETS_DIR)).isDirectory(),
  };
}

function readRepoFile(repoPath) {
  return readFileSync(abs(repoPath), 'utf8');
}

function pushFailureIfMissing(failures, condition, message) {
  if (!condition) failures.push(message);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasAssetsDirectory(source, expectedDirectory) {
  return new RegExp(
    String.raw`\[assets\][\s\S]*?directory\s*=\s*"${escapeRegExp(expectedDirectory)}"`
  ).test(source);
}

function collectPositiveContractFailures() {
  const failures = [];
  const rootWrangler = readRepoFile('wrangler.cloudflare.toml');
  const topology = readRepoFile(
    'src/shared/config/cloudflare-worker-topology.ts'
  );
  const buildScript = readRepoFile('scripts/run-cf-build.mjs');
  const stateWorker = readRepoFile('cloudflare/workers/state.ts');
  const routerWorker = readRepoFile('cloudflare/workers/router.ts');

  pushFailureIfMissing(
    failures,
    hasAssetsDirectory(rootWrangler, NATIVE_ASSETS_DIR),
    `wrangler.cloudflare.toml assets.directory must be ${NATIVE_ASSETS_DIR}`
  );

  for (const target of SERVER_WORKER_TARGETS) {
    const workerPath = `cloudflare/workers/server-${target}.ts`;
    const wranglerPath = `cloudflare/wrangler.server-${target}.toml`;
    const workerSource = readRepoFile(workerPath);
    const wranglerSource = readRepoFile(wranglerPath);

    pushFailureIfMissing(
      failures,
      workerSource.includes("import('../../dist/server/server.mjs')"),
      `${workerPath} must import ../../${NATIVE_SERVER_ARTIFACT}`
    );
    pushFailureIfMissing(
      failures,
      hasAssetsDirectory(wranglerSource, `../${NATIVE_ASSETS_DIR}`),
      `${wranglerPath} assets.directory must be ../${NATIVE_ASSETS_DIR}`
    );
    pushFailureIfMissing(
      failures,
      !workerSource.includes('StatefulLimitersDurableObject'),
      `${workerPath} must not import or call state Durable Object classes`
    );
  }

  const topologyArtifactCount =
    topology.split(`bundleEntryRelativePath: '${NATIVE_SERVER_ARTIFACT}'`)
      .length - 1;
  pushFailureIfMissing(
    failures,
    topologyArtifactCount === SERVER_WORKER_TARGETS.length,
    `cloudflare-worker-topology must pin all server bundle entries to ${NATIVE_SERVER_ARTIFACT}`
  );

  pushFailureIfMissing(
    failures,
    buildScript.includes(
      "'exec', 'vite', 'build', '--config', 'vite.config.mts'"
    ),
    'run-cf-build.mjs must invoke pnpm exec vite build --config vite.config.mts'
  );
  pushFailureIfMissing(
    failures,
    !buildScript.includes('bundle-cf-server-functions') &&
      !buildScript.includes('opennextjs-cloudflare build'),
    'run-cf-build.mjs must not call obsolete OpenNext/bundler build paths'
  );
  pushFailureIfMissing(
    failures,
    routerWorker.includes('withRouterResponseHeaders') &&
      routerWorker.includes('applyNativeRouterMiddleware'),
    'router.ts must apply native router middleware and response headers'
  );
  pushFailureIfMissing(
    failures,
    stateWorker.includes('StatefulLimitersDurableObject'),
    'state.ts must keep state Durable Object exports isolated in state worker'
  );

  return failures;
}

function printGroup(name, hits) {
  if (hits.length === 0) return;
  console.log(`\n[${name}] ${hits.length}`);
  for (const hit of hits) {
    console.log(`- ${hit.repoPath}:${hit.line} ${hit.text}`);
    console.log(`  reason: ${hit.reason}`);
  }
}

const hits = collectHits();
const activeBlockers = hits.filter(
  (hit) => hit.classification === 'active_blocker'
);
const configBlockers = hits.filter(
  (hit) => hit.classification === 'active_config_blocker'
);
const deferred = hits.filter(
  (hit) => hit.classification === 'defer_gate_5_6_dependency'
);
const artifact = hasNativeArtifactContract();
const artifactBlockers = [];
if (!artifact.serverArtifactPresent)
  artifactBlockers.push(NATIVE_SERVER_ARTIFACT);
if (!artifact.assetsDirPresent) artifactBlockers.push(NATIVE_ASSETS_DIR);
const positiveContractFailures = collectPositiveContractFailures();

console.log('Gate 5.5 native Cloudflare topology report');
console.log(
  `native server artifact: ${NATIVE_SERVER_ARTIFACT} ${artifact.serverArtifactPresent ? 'present' : 'missing'}`
);
console.log(
  `native assets directory: ${NATIVE_ASSETS_DIR} ${artifact.assetsDirPresent ? 'present' : 'missing'}`
);
console.log(`active OpenNext runtime/build blockers: ${activeBlockers.length}`);
console.log(`active OpenNext config blockers: ${configBlockers.length}`);
console.log(
  `positive native contract blockers: ${positiveContractFailures.length}`
);
console.log(`deferred Gate 5.6 dependency residues: ${deferred.length}`);

printGroup('active_blocker', activeBlockers);
printGroup('active_config_blocker', configBlockers);
printGroup('defer_gate_5_6_dependency', deferred);

const failures = [];
if (artifactBlockers.length > 0) {
  failures.push(
    `native artifact contract missing: ${artifactBlockers.join(', ')}`
  );
}
for (const failure of positiveContractFailures) failures.push(failure);
if (!reportMode && activeBlockers.length > 0) {
  failures.push(
    `active OpenNext runtime/build blockers remain: ${activeBlockers.length}`
  );
}
if (!reportMode && configBlockers.length > 0) {
  failures.push(
    `active OpenNext config blockers remain: ${configBlockers.length}`
  );
}

if (failures.length > 0) {
  console.error('\nGate 5.5 native Cloudflare topology check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  reportMode
    ? '\nGate 5.5 report completed.'
    : '\nGate 5.5 native Cloudflare topology check passed.'
);
