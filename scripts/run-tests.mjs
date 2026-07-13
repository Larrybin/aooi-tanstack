import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const TEST_FILE_PATTERN = /\.(test|spec)\.(mjs|[tj]sx?)$/;
const SERVER_TEST_FILE_PATTERN = /\.server\.(test|spec)\.(mjs|[tj]sx?)$/;
const IGNORED_DIRS = new Set(['.git', 'dist', 'node_modules', 'out']);
const EXCLUDED_TEST_FILES = new Set([
  'src/architecture-boundaries.test.ts',
  'tests/smoke/auth-dual-runtime.test.ts',
]);

export function parseTestRunnerArgs(args) {
  return {
    coverageEnabled: args.includes('--coverage'),
    requestedFiles: args.filter((arg) => arg !== '--coverage' && arg !== '--'),
  };
}

function toRepoPath(filePath) {
  return relative(ROOT_DIR, resolve(ROOT_DIR, filePath)).split(sep).join('/');
}

export function filterRequestedTestFiles(testFiles, requestedFiles) {
  if (requestedFiles.length === 0) {
    return testFiles;
  }

  const requestedRepoPaths = new Set(requestedFiles.map(toRepoPath));
  const matchedRepoPaths = new Set();
  const selectedFiles = testFiles.filter((filePath) => {
    const repoPath = toRepoPath(filePath);
    if (!requestedRepoPaths.has(repoPath)) {
      return false;
    }

    matchedRepoPaths.add(repoPath);
    return true;
  });

  const missingFiles = [...requestedRepoPaths].filter(
    (repoPath) => !matchedRepoPaths.has(repoPath)
  );
  if (missingFiles.length > 0) {
    throw new Error(`Unknown test file(s): ${missingFiles.join(', ')}`);
  }

  return selectedFiles;
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function collectTestFiles(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await collectTestFiles(resolve(dir, entry.name), out);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!TEST_FILE_PATTERN.test(entry.name)) continue;

    const filePath = resolve(dir, entry.name);
    const repoPath = relative(ROOT_DIR, filePath).split(sep).join('/');
    if (EXCLUDED_TEST_FILES.has(repoPath)) continue;

    out.push(filePath);
  }
}

async function main() {
  const options = parseTestRunnerArgs(process.argv.slice(2));
  process.chdir(ROOT_DIR);

  const candidateRoots = [];
  for (const name of ['apps', 'src', 'test', 'tests', 'scripts']) {
    const path = resolve(ROOT_DIR, name);
    if (await isDirectory(path)) candidateRoots.push(path);
  }

  const testFiles = [];
  for (const root of candidateRoots) {
    await collectTestFiles(root, testFiles);
  }

  testFiles.sort((a, b) => a.localeCompare(b));
  const selectedTestFiles = filterRequestedTestFiles(
    testFiles,
    options.requestedFiles
  );

  if (selectedTestFiles.length === 0) {
    process.stderr.write(
      'No test files found (expected **/*.test.(mjs|ts|tsx|js|jsx) or **/*.spec.(mjs|ts|tsx|js|jsx)).\n'
    );
    process.exit(1);
  }

  const defaultTestFiles = selectedTestFiles.filter(
    (filePath) => !SERVER_TEST_FILE_PATTERN.test(filePath)
  );
  const reactServerTestFiles = selectedTestFiles.filter((filePath) =>
    SERVER_TEST_FILE_PATTERN.test(filePath)
  );

  for (const command of [
    {
      label: 'default',
      useReactServer: false,
      files: defaultTestFiles,
    },
    {
      label: 'react-server',
      useReactServer: true,
      files: reactServerTestFiles,
    },
  ]) {
    if (command.files.length === 0) continue;

    const nodeArgs = ['--test', '--import', 'tsx', ...command.files];
    if (command.useReactServer) {
      nodeArgs.unshift('react-server');
      nodeArgs.unshift('--conditions');
    }
    if (options.coverageEnabled) {
      nodeArgs.unshift('--experimental-test-coverage');
    }

    const exitCode = await new Promise((resolveExitCode) => {
      const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit' });
      child.on('exit', (code, signal) => {
        if (typeof code === 'number') {
          resolveExitCode(code);
          return;
        }
        if (signal) {
          process.stderr.write(
            `Tests (${command.label}) terminated by signal: ${signal}\n`
          );
        }
        resolveExitCode(1);
      });
    });

    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
