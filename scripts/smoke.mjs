import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SMOKE_SCENARIOS = Object.freeze({
  'auth-spike': {
    script: 'scripts/run-auth-spike.mjs',
  },
});

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

export function getSmokeScenarioCommand(
  scenario,
  { nodePath = process.execPath } = {}
) {
  const config = SMOKE_SCENARIOS[scenario];
  if (!config) {
    throw new Error(
      `Unknown smoke scenario "${scenario}". Expected one of: ${Object.keys(SMOKE_SCENARIOS).join(', ')}`
    );
  }

  return {
    command: nodePath,
    args: ['--import', 'tsx', path.resolve(rootDir, config.script)],
  };
}

export async function runSmokeScenario(
  scenario,
  {
    spawnImpl = spawn,
    cwd = rootDir,
    env = process.env,
    stdio = 'inherit',
  } = {}
) {
  const { command, args } = getSmokeScenarioCommand(scenario);
  const child = spawnImpl(command, args, {
    cwd,
    env,
    stdio,
  });

  return await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const scenario = process.argv[2];
  if (!scenario) {
    throw new Error(
      `Smoke scenario is required. Expected one of: ${Object.keys(SMOKE_SCENARIOS).join(', ')}`
    );
  }

  const exitCode = await runSmokeScenario(scenario);
  process.exit(exitCode);
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
