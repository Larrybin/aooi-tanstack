
import type { AuthServerBindings } from '@/domains/settings/application/settings-runtime.contracts';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

function readAuthServerBindings(): AuthServerBindings {
  return {
    googleClientId: getRuntimeEnvString('GOOGLE_CLIENT_ID')?.trim() || '',
    googleClientSecret:
      getRuntimeEnvString('GOOGLE_CLIENT_SECRET')?.trim() || '',
    githubClientId: getRuntimeEnvString('GITHUB_CLIENT_ID')?.trim() || '',
    githubClientSecret:
      getRuntimeEnvString('GITHUB_CLIENT_SECRET')?.trim() || '',
  };
}

export function getAuthServerBindings(): AuthServerBindings {
  return { ...readAuthServerBindings() };
}
