import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createCanonicalTypegenWranglerConfig,
  normalizeTrackedTypes,
} from './check-cf-typegen.mjs';

const rootDir = process.cwd();
const trackedTypesPath = path.resolve(
  rootDir,
  'src/shared/types/cloudflare.d.ts'
);

async function normalizeTrackedTypesHeader() {
  const content = await readFile(trackedTypesPath, 'utf8');
  const normalized = normalizeTrackedTypes(content);

  if (normalized !== content) {
    await writeFile(trackedTypesPath, normalized, 'utf8');
  }
}

async function main() {
  const artifacts = await createCanonicalTypegenWranglerConfig();

  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        'pnpm',
        [
          'exec',
          'wrangler',
          'types',
          '--config',
          artifacts.configPath,
          '--env-interface',
          'CloudflareEnv',
          trackedTypesPath,
        ],
        {
          cwd: rootDir,
          env: process.env,
          stdio: 'inherit',
        }
      );

      child.once('error', reject);
      child.once('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`wrangler types exited with code ${code}`));
          return;
        }

        resolve(undefined);
      });
    });
    await normalizeTrackedTypesHeader();
  } finally {
    await artifacts.cleanup();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
