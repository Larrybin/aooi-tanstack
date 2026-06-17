import { readFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as authSpikeBrowserModule from '../src/testing/auth-spike.browser.ts';
import * as adminSettingsSmokeModule from './lib/admin-settings-smoke.ts';
import { runNodeScript, stopChild } from './lib/harness/runtime.mjs';
import { resolveSiteDeployContract } from './lib/site-deploy-contract.mjs';
import {
  buildNodeAuthSpikeEnv,
  createNodeDevManager,
  detectReusableNodeServer,
  readWranglerLocalConnectionString,
  waitForNodeReady,
} from './run-local-auth-spike.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_PASSWORD = 'ModuleContract123!module';
const DEFAULT_NAME = 'Module Contract Smoke';
const DEFAULT_AUTH_SECRET = 'module-contract-smoke-secret-0123456789';
const adminSettingsSmoke =
  adminSettingsSmokeModule.default ?? adminSettingsSmokeModule;
const {
  captureAdminSettingsModuleContractSnapshot,
  getAdminSettingsModuleContractChecks,
  validateAdminSettingsModuleContractSnapshot,
} = adminSettingsSmoke;
const authSpikeBrowser =
  authSpikeBrowserModule.default ?? authSpikeBrowserModule;
const {
  closeAuthBrowserHarness,
  createAuthBrowserHarness,
  signUpWithAuthBrowserHarness,
} = authSpikeBrowser;

function createTempEmail() {
  return `module-contract-smoke+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function canListenOnPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await canListenOnPort(port)) {
      return port;
    }
  }

  throw new Error(`No available local port found from ${startPort}`);
}

export async function main() {
  const wranglerConfigPath =
    process.env.CF_LOCAL_SMOKE_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(
      rootDir,
      resolveSiteDeployContract({ rootDir }).router.wranglerConfigRelativePath
    );
  const databaseUrl =
    process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    readWranglerLocalConnectionString(
      await readFile(wranglerConfigPath, 'utf8')
    );
  const preferredBaseUrl =
    process.env.ADMIN_SETTINGS_MODULE_CONTRACT_BASE_URL?.trim() ||
    DEFAULT_BASE_URL;
  const authSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    DEFAULT_AUTH_SECRET;
  const preferredPort = Number.parseInt(
    new URL(preferredBaseUrl).port || '3000',
    10
  );
  const reuseServer =
    process.env.ADMIN_SETTINGS_MODULE_CONTRACT_REUSE_SERVER !== 'false' &&
    (await detectReusableNodeServer({
      baseUrl: preferredBaseUrl,
      logger: { log: () => undefined },
    }));
  const baseUrl = reuseServer
    ? preferredBaseUrl
    : `http://127.0.0.1:${await findAvailablePort(preferredPort)}`;
  const nodeEnv = buildNodeAuthSpikeEnv(process.env, {
    databaseUrl,
    authSecret,
    appUrl: baseUrl,
  });
  const nodeManager = reuseServer
    ? null
    : createNodeDevManager({
        env: nodeEnv,
        port: Number.parseInt(new URL(baseUrl).port || '3000', 10),
      });

  const harness = await createAuthBrowserHarness();
  const email = createTempEmail();

  try {
    await waitForNodeReady({ baseUrl });
    await runNodeScript({
      cwd: rootDir,
      scriptPath: 'scripts/init-rbac.ts',
      env: nodeEnv,
    });
    await signUpWithAuthBrowserHarness({
      harness,
      baseUrl,
      email,
      password: DEFAULT_PASSWORD,
      callbackPath: '/settings/profile',
      userName: DEFAULT_NAME,
    });
    await runNodeScript({
      cwd: rootDir,
      scriptPath: 'scripts/assign-role.ts',
      args: [`--email=${email}`, '--role=super_admin'],
      env: nodeEnv,
    });

    for (const check of getAdminSettingsModuleContractChecks()) {
      await harness.page.goto(`${baseUrl}${check.path}`, {
        waitUntil: 'domcontentloaded',
      });
      const snapshot = await captureAdminSettingsModuleContractSnapshot(
        harness.page
      );
      validateAdminSettingsModuleContractSnapshot(check, snapshot);
    }
  } finally {
    await closeAuthBrowserHarness(harness);
    await stopChild(nodeManager?.child);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
