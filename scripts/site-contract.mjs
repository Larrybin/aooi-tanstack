import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRequiredSiteKey } from './lib/site-config.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import {
  isProductionAuthRequired,
  isProductionHyperdriveRequired,
} from './site-production.mjs';

function printStatus(status, label, detail = '') {
  console.log(`[${status}] ${label}${detail ? `: ${detail}` : ''}`);
}

export function deriveSiteProductProfile(contract) {
  const enabledModules = contract.site.capabilities.enabledModules;
  return enabledModules.length === 1 &&
    enabledModules[0] === 'analytics' &&
    contract.bindingRequirements.bindings.hyperdrive === false
    ? 'free-tool-no-db'
    : 'custom';
}

function assertFreeToolNoDbContract({ contract, rootDir }) {
  const failures = [];
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

  return {
    failures,
    profile: 'free-tool-no-db',
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
  };
}

async function main() {
  const rootDir = process.cwd();
  const siteKey = resolveRequiredSiteKey();
  const result = checkSiteContract({ rootDir, siteKey });

  printStatus('ok', 'site', siteKey);
  printStatus('ok', 'product profile', result.profile);

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
