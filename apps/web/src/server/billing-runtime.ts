import { buildBillingRuntimeSettings } from '@/domains/settings/application/settings-runtime.builders';
import type { BillingRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { db } from '@/infra/adapters/db';
import { mergeAuthSpikeOAuthConfigSeedConfigs } from '@/infra/platform/auth/oauth-spike-config';
import {
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
} from '@/infra/runtime/env.server';

import { config } from '@/config/db/schema';
import { mergeCloudflareLocalSmokeConfigSeedConfigs } from '@/shared/lib/cloudflare-local-smoke-config';

type Configs = Record<string, string>;

async function readTanStackSettingsFresh(): Promise<Configs> {
  const configs: Configs = {};
  const runtimeEnv = getServerRuntimeEnv();

  if (!runtimeEnv.databaseUrl && !isCloudflareWorkersRuntime()) {
    return mergeAuthSpikeOAuthConfigSeedConfigs(configs);
  }

  const rows = await db().select().from(config);
  for (const row of rows) {
    configs[row.name] = row.value ?? '';
  }

  return mergeCloudflareLocalSmokeConfigSeedConfigs(
    mergeAuthSpikeOAuthConfigSeedConfigs(configs)
  );
}

export async function readTanStackBillingRuntimeSettings(): Promise<BillingRuntimeSettings> {
  return buildBillingRuntimeSettings(await readTanStackSettingsFresh());
}
