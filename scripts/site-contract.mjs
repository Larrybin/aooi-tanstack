import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import {
  isFreeToolBuildContract,
  resolveSiteRoutePrunePaths,
} from './lib/site-route-pruning.mjs';
import {
  isProductionAuthRequired,
  isProductionHyperdriveRequired,
} from './site-production.mjs';

const FREE_TOOL_NO_DB_REQUIRED_PRUNED_PATHS = Object.freeze([
  'src/app/[locale]/(admin)',
  'src/app/[locale]/(auth)',
  'src/app/[locale]/(chat)',
  'src/app/[locale]/(docs)',
  'src/app/[locale]/(landing)/blog',
  'src/app/[locale]/(landing)/pricing',
  'src/app/[locale]/(landing)/settings',
  'src/app/api/auth',
  'src/app/api/config',
  'src/app/api/payment',
  'src/app/api/user',
  'apps/web/src/routes/admin_.tsx',
  'apps/web/src/routes/$locale/admin_.tsx',
  'apps/web/src/routes/sign-in.tsx',
  'apps/web/src/routes/$locale/sign-in.tsx',
  'apps/web/src/routes/chat_.tsx',
  'apps/web/src/routes/$locale/chat_.tsx',
  'apps/web/src/routes/docs_.tsx',
  'apps/web/src/routes/$locale/docs_.tsx',
  'apps/web/src/routes/blog_.tsx',
  'apps/web/src/routes/$locale/blog_.tsx',
  'apps/web/src/routes/pricing.tsx',
  'apps/web/src/routes/$locale/pricing.tsx',
  'apps/web/src/routes/settings_.tsx',
  'apps/web/src/routes/$locale/settings_.tsx',
  'apps/web/src/routes/api/auth.ts',
  'apps/web/src/routes/api/config',
  'apps/web/src/routes/api/payment',
  'apps/web/src/routes/api/user',
]);

function printStatus(status, label, detail = '') {
  console.log(`[${status}] ${label}${detail ? `: ${detail}` : ''}`);
}

export function deriveSiteProductProfile(contract) {
  return isFreeToolBuildContract(contract) ? 'free-tool-no-db' : 'custom';
}

function assertFreeToolNoDbContract({ contract, rootDir }) {
  const failures = [];
  const prunePaths = resolveSiteRoutePrunePaths(contract);
  const pruneSet = new Set(prunePaths);
  const deploySettings = {
    bindingRequirements: contract.bindingRequirements,
  };
  const productionAuthRequired = isProductionAuthRequired({
    deploySettings,
    siteConfig: contract.site,
  });
  const productionHyperdriveRequired =
    isProductionHyperdriveRequired(deploySettings);

  if (Object.keys(contract.serverWorkers).join(',') !== 'public-web') {
    failures.push(
      'free-tool-no-db must only expose the public-web server worker'
    );
  }

  if (contract.bindingRequirements.bindings.hyperdrive !== false) {
    failures.push('free-tool-no-db must disable Hyperdrive');
  }

  if (contract.bindingRequirements.secrets.authSharedSecret !== false) {
    failures.push('free-tool-no-db must disable auth shared secret');
  }

  if (productionHyperdriveRequired) {
    failures.push('production checks must not require Hyperdrive');
  }

  if (productionAuthRequired) {
    failures.push('production checks must not require auth secrets');
  }

  for (const relativePath of FREE_TOOL_NO_DB_REQUIRED_PRUNED_PATHS) {
    if (!pruneSet.has(relativePath)) {
      failures.push(
        `free-tool-no-db route pruning must include ${relativePath}`
      );
    }
  }

  return {
    failures,
    profile: 'free-tool-no-db',
    prunePaths,
  };
}

export function checkSiteContract({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  processEnv = process.env,
} = {}) {
  const contract = resolveSiteDeployContract({
    rootDir,
    siteKey,
    processEnv,
  });
  const profile = deriveSiteProductProfile(contract);

  if (profile === 'free-tool-no-db') {
    return assertFreeToolNoDbContract({ contract, rootDir });
  }

  return {
    failures: [],
    profile,
    prunePaths: resolveSiteRoutePrunePaths(contract),
  };
}

async function main() {
  const rootDir = process.cwd();
  const siteKey = resolveRequiredSiteKey();
  const result = checkSiteContract({ rootDir, siteKey });

  printStatus('ok', 'site', siteKey);
  printStatus('ok', 'product profile', result.profile);

  if (result.profile === 'free-tool-no-db') {
    printStatus('ok', 'route pruning paths', String(result.prunePaths.length));
  }

  if (result.failures.length > 0) {
    for (const failure of result.failures) {
      printStatus('fail', 'site contract', failure);
    }
    process.exit(1);
  }

  printStatus('ok', 'site contract');
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
