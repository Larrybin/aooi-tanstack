import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { withIpv4FirstNodeOptions } from './lib/node-process-env.mjs';
import { syncOpenNextGeneratedTypes } from './sync-open-next-generated-types.mjs';

const nextBin = resolve(process.cwd(), 'node_modules/next/dist/bin/next');

await syncOpenNextGeneratedTypes();

const i18nCheck = spawnSync(
  process.execPath,
  ['scripts/check-site-i18n.mjs', '--site', process.env.SITE || 'dev-local'],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

if (i18nCheck.status !== 0) {
  process.stderr.write('[i18n:check] continuing non-strict local build\n');
}

const child = spawn(
  process.execPath,
  [...process.argv.slice(2), nextBin, 'build', '--webpack'],
  {
    stdio: 'inherit',
    env: withIpv4FirstNodeOptions(process.env),
  }
);

child.on('exit', (code, signal) => {
  if (typeof code === 'number') process.exit(code);
  if (signal) {
    process.stderr.write(`Build terminated by signal: ${signal}\n`);
  }
  process.exit(1);
});
