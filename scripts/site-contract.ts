import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSiteCloudflareContract } from './cloudflare/contract';

export function deriveSiteProductProfile(
  contract: ReturnType<typeof resolveSiteCloudflareContract>
) {
  const modules = contract.site.capabilities.enabledModules;
  return modules.length === 1 &&
    modules[0] === 'analytics' &&
    !contract.requires.database
    ? 'free-tool-no-db'
    : 'application';
}

export function checkSiteContract({
  siteKey = process.env.SITE?.trim(),
  rootDir = process.cwd(),
} = {}) {
  const contract = resolveSiteCloudflareContract({ rootDir, siteKey });
  const profile = deriveSiteProductProfile(contract);
  const failures: string[] = [];

  if (profile === 'free-tool-no-db') {
    if (contract.requires.database) failures.push('must not require database');
    if (contract.requires.state) failures.push('must not require state worker');
    if (contract.resources.hyperdriveId) {
      failures.push('must not configure Hyperdrive');
    }
  }

  return { contract, failures, profile };
}

async function main() {
  const result = checkSiteContract();
  if (result.failures.length) {
    throw new Error(result.failures.join('; '));
  }
  console.log(
    `[site:contract] ${result.contract.siteKey}: ${result.profile} passed`
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
