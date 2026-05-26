import { spawn } from 'node:child_process';
import path from 'node:path';

const HYPERDRIVE_ID_PATTERN = /^[a-f0-9]{32}$/u;
const ANSI_PATTERN = /\u001b\[[0-9;]*m/gu;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function isValidHyperdriveId(value) {
  return HYPERDRIVE_ID_PATTERN.test(value);
}

export function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, '');
}

export function redactValues(value, secrets) {
  let result = value;
  for (const secret of secrets) {
    if (secret) {
      result = result.split(secret).join('<redacted>');
    }
  }
  return result;
}

export function r2BucketListHasName(output, bucketName) {
  const cleanOutput = stripAnsi(output);
  const pattern = new RegExp(
    `(^|[^a-z0-9.-])${escapeRegExp(bucketName)}([^a-z0-9.-]|$)`,
    'u'
  );
  return pattern.test(cleanOutput);
}

export function parseHyperdriveIdFromOutput(output) {
  const cleanOutput = stripAnsi(output);
  const preferredMatch = cleanOutput.match(
    /\b(?:id|ID)\s*[:=]\s*([a-f0-9]{32})\b/u
  );
  if (preferredMatch) {
    return preferredMatch[1];
  }

  return cleanOutput.match(/\b[a-f0-9]{32}\b/u)?.[0] ?? '';
}

export function withCommandPathFallback(env, processEnv = process.env) {
  env.PATH = [
    processEnv.PATH,
    env.PATH,
    path.dirname(process.execPath),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ]
    .filter(Boolean)
    .join(':');

  return env;
}

export function formatStatusLine(status, label, detail = '') {
  return `[${status}] ${label}${detail ? `: ${detail}` : ''}`;
}

export function printStatus(status, label, detail = '') {
  console.log(formatStatusLine(status, label, detail));
}

export function runCommandCapture(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      resolve({
        code: 1,
        output: error.message,
        stderr: error.message,
        stdout,
      });
    });
    child.on('close', (code) => {
      resolve({
        code: typeof code === 'number' ? code : 1,
        output: `${stdout}${stderr}`,
        stderr,
        stdout,
      });
    });
  });
}

export function runCommandInherit(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });

    child.on('error', () => {
      resolve(1);
    });
    child.on('close', (code) => {
      resolve(typeof code === 'number' ? code : 1);
    });
  });
}

function resolvePnpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath) {
    return {
      args: [npmExecPath, ...args],
      command: process.execPath,
    };
  }

  return {
    args,
    command: 'pnpm',
  };
}

export function runPnpmCapture(args, env) {
  const invocation = resolvePnpmInvocation(args);
  return runCommandCapture(invocation.command, invocation.args, env);
}

export function runPnpmInherit(args, env) {
  const invocation = resolvePnpmInvocation(args);
  return runCommandInherit(invocation.command, invocation.args, env);
}

export function runWrangler(args, env) {
  return runPnpmCapture(['exec', 'wrangler', ...args], env);
}

export function assertWranglerSuccess(label, result, secrets = []) {
  if (result.code === 0) {
    return;
  }

  const output = redactValues(stripAnsi(result.output).trim(), secrets);
  throw new Error(`${label} failed${output ? `:\n${output}` : ''}`);
}

export async function checkR2Bucket(bucketName, env) {
  const result = await runWrangler(['r2', 'bucket', 'list'], env);
  assertWranglerSuccess('list R2 buckets', result);
  return r2BucketListHasName(result.output, bucketName);
}

export async function ensureR2Bucket(bucketName, env) {
  if (await checkR2Bucket(bucketName, env)) {
    printStatus('ok', 'R2 bucket', bucketName);
    return;
  }

  printStatus('create', 'R2 bucket', bucketName);
  const result = await runWrangler(['r2', 'bucket', 'create', bucketName], env);
  if (
    result.code !== 0 &&
    !/already exists|already owned|bucket exists/iu.test(result.output)
  ) {
    assertWranglerSuccess(`create R2 bucket ${bucketName}`, result);
  }
  printStatus('ok', 'R2 bucket', bucketName);
}

export async function checkHyperdrive(hyperdriveId, env) {
  if (!isValidHyperdriveId(hyperdriveId)) {
    return false;
  }

  const result = await runWrangler(['hyperdrive', 'get', hyperdriveId], env);
  return result.code === 0;
}

export async function checkWorker(workerName, env) {
  const result = await runWrangler(
    ['deployments', 'list', '--name', workerName, '--json'],
    env
  );
  return result.code === 0;
}
