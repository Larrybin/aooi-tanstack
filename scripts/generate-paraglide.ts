import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSiteBuildPaths } from './lib/build-paths';
import { resolveRequiredSiteKey } from './lib/site-config';

export function generateParaglide({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
  env = process.env,
}: {
  rootDir?: string;
  siteKey?: string;
  env?: NodeJS.ProcessEnv;
} = {}) {
  return new Promise<void>((resolve, reject) => {
    const outputDir = path.resolve(
      resolveSiteBuildPaths({ rootDir, siteKey, env }).generatedDir,
      'paraglide'
    );
    const child = spawn(
      'pnpm',
      [
        'exec',
        'paraglide-js',
        'compile',
        '--project',
        './project.inlang',
        '--outdir',
        outputDir,
        '--strategy',
        'globalVariable',
        'baseLocale',
        '--is-server',
        'import.meta.env.SSR',
        '--emit-ts-declarations',
        '--no-emit-git-ignore',
        '--no-emit-prettier-ignore',
        '--no-emit-readme',
      ],
      { cwd: rootDir, env, stdio: 'inherit' }
    );
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`paraglide compile exited with code ${code ?? 1}`));
    });
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  generateParaglide().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
