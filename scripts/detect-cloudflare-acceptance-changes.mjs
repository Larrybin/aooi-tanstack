import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();

export const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const CLOUDFLARE_EXACT_PATHS = new Set([
  '.github/workflows/cloudflare-acceptance.yaml',
  'docs/architecture/cloudflare-deployment-governance.md',
  'package.json',
  'pnpm-lock.yaml',
  'scripts/check-cloudflare-config.mjs',
  'scripts/detect-cloudflare-acceptance-changes.mjs',
  'scripts/lib/site-config.mjs',
  'wrangler.cloudflare.toml',
]);

const CLOUDFLARE_PREFIXES = [
  'apps/web/src/',
  'cloudflare/',
  'scripts/create-cf-',
  'scripts/lib/cloudflare-',
  'scripts/lib/site-deploy-',
  'scripts/run-cf-',
  'sites/',
  'src/',
];

const AI_REMOVER_CONTRACT_EXACT_PATHS = new Set([
  'scripts/check-saas-product-contract.mjs',
  'scripts/check-saas-product-contract.test.ts',
  'src/server/admin/admin-route-resolver.ts',
  'src/config/db/schema.ts',
  'src/config/env-contract.ts',
  'src/domains/settings/application/settings-runtime.contracts.ts',
  'tests/contract/payment-notify.test.ts',
]);

const AI_REMOVER_CONTRACT_PREFIXES = [
  'apps/web/src/routes/api/ai/',
  'apps/web/src/routes/api/remover/',
  'docs/product/ai-remover/',
  'sites/ai-remover/',
  'src/config/saas-product-contract/',
  'src/config/db/migrations/',
  'src/domains/account/',
  'src/domains/ai/',
  'src/domains/billing/',
  'src/domains/remover/',
  'src/domains/settings/definitions/',
  'src/extensions/ai/',
  'src/infra/runtime/',
  'src/server/api/ai/',
  'src/server/api/remover/',
  'src/surfaces/admin/schemas/list/',
];

function parseArgs(argv) {
  const options = {
    baseSha: '',
    eventName: '',
    githubOutput: process.env.GITHUB_OUTPUT || '',
    headSha: '',
  };

  for (const arg of argv) {
    if (arg.startsWith('--base-sha=')) {
      options.baseSha = arg.slice('--base-sha='.length).trim();
      continue;
    }

    if (arg.startsWith('--event-name=')) {
      options.eventName = arg.slice('--event-name='.length).trim();
      continue;
    }

    if (arg.startsWith('--github-output=')) {
      options.githubOutput = arg.slice('--github-output='.length).trim();
      continue;
    }

    if (arg.startsWith('--head-sha=')) {
      options.headSha = arg.slice('--head-sha='.length).trim();
    }
  }

  if (!options.headSha && options.eventName !== 'workflow_dispatch') {
    throw new Error('--head-sha is required');
  }

  return options;
}

function isZeroSha(value) {
  return Boolean(value) && /^0+$/.test(value);
}

function matchesPath(path, exactPaths, prefixes) {
  return (
    exactPaths.has(path) || prefixes.some((prefix) => path.startsWith(prefix))
  );
}

export async function resolveBaseSha({
  baseSha,
  headSha,
  execFileImpl = execFileAsync,
} = {}) {
  if (baseSha && !isZeroSha(baseSha)) {
    return baseSha;
  }

  try {
    const { stdout } = await execFileImpl(
      'git',
      ['rev-parse', `${headSha}^1`],
      {
        cwd: rootDir,
      }
    );
    return stdout.trim();
  } catch {
    return EMPTY_TREE_SHA;
  }
}

export async function readChangedPaths({
  baseSha,
  headSha,
  execFileImpl = execFileAsync,
} = {}) {
  const resolvedBaseSha = await resolveBaseSha({
    baseSha,
    headSha,
    execFileImpl,
  });
  const { stdout } = await execFileImpl(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=ACDMRTUXB',
      resolvedBaseSha,
      headSha,
    ],
    { cwd: rootDir }
  );

  return stdout
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

export function classifyChangedPaths(changedPaths) {
  return {
    cloudflareChanged: changedPaths.some((path) =>
      matchesPath(path, CLOUDFLARE_EXACT_PATHS, CLOUDFLARE_PREFIXES)
    ),
    contractAiRemoverChanged: changedPaths.some((path) =>
      matchesPath(
        path,
        AI_REMOVER_CONTRACT_EXACT_PATHS,
        AI_REMOVER_CONTRACT_PREFIXES
      )
    ),
  };
}

export function createDetectionReport({ eventName, changedPaths }) {
  if (eventName === 'workflow_dispatch') {
    return {
      cloudflareChanged: true,
      contractAiRemoverChanged: true,
      changedPathCount: changedPaths.length,
      reason: 'workflow_dispatch',
    };
  }

  return {
    ...classifyChangedPaths(changedPaths),
    changedPathCount: changedPaths.length,
    reason: 'changed_paths',
  };
}

export async function writeGithubOutputs(report, githubOutput) {
  if (!githubOutput) {
    return;
  }

  await appendFile(
    githubOutput,
    [
      `cloudflare_changed=${report.cloudflareChanged}`,
      `contract_ai_remover_changed=${report.contractAiRemoverChanged}`,
      `changed_path_count=${report.changedPathCount}`,
      `reason=${report.reason}`,
      '',
    ].join('\n'),
    'utf8'
  );
}

export async function runDetection(options) {
  const changedPaths =
    options.eventName === 'workflow_dispatch'
      ? []
      : await readChangedPaths(options);
  const report = createDetectionReport({
    eventName: options.eventName,
    changedPaths,
  });
  await writeGithubOutputs(report, options.githubOutput);
  process.stdout.write(
    `[cloudflare-acceptance] reason=${report.reason} changed_paths=${report.changedPathCount} cloudflare_changed=${report.cloudflareChanged} contract_ai_remover_changed=${report.contractAiRemoverChanged}\n`
  );
  return report;
}

if (process.argv[1]?.endsWith('detect-cloudflare-acceptance-changes.mjs')) {
  runDetection(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
