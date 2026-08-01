import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Generator, getConfig } from '@tanstack/router-generator';

import { resolveSiteBuildPaths } from './lib/build-paths';
import { readCurrentSiteConfig } from './lib/site-config.ts';
import { buildSiteRouteIgnorePattern } from './lib/site-route-assembly.ts';

export async function generateRouteTree({
  rootDir = process.cwd(),
  site = readCurrentSiteConfig({ rootDir }),
} = {}) {
  const { generatedDir } = resolveSiteBuildPaths({
    rootDir,
    siteKey: site.key,
  });
  const config = getConfig(
    {
      target: 'react',
      routesDirectory: 'apps/web/src/routes',
      generatedRouteTree: path.join(generatedDir, 'routeTree.gen.ts'),
      routeFileIgnorePattern: buildSiteRouteIgnorePattern({
        rootDir,
        site,
      }),
      quoteStyle: 'single',
      semicolons: true,
    },
    rootDir
  );
  await new Generator({ config, root: rootDir }).run();
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  generateRouteTree().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  });
}
