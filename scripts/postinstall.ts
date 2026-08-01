import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

const requiredPaths = [
  path.resolve(rootDir, 'scripts', 'generate-content-source-module.mts'),
  path.resolve(rootDir, 'source.config.ts'),
  path.resolve(rootDir, 'sites', 'dev-local', 'site.config.json'),
  path.resolve(rootDir, 'sites', 'dev-local', 'content'),
];

if (!requiredPaths.every((requiredPath) => existsSync(requiredPath))) {
  process.stdout.write(
    '[postinstall] skipped content source generation because build prerequisites are unavailable\n'
  );
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'scripts/generate-content-source-module.mts'],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      SITE: 'dev-local',
    },
    stdio: 'inherit',
  }
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
