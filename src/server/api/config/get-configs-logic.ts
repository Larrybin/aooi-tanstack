import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { jsonOk } from '@/shared/lib/api/response';
import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';

type GetConfigsLogicDeps = {
  getPublicUiConfigCached: () => Promise<PublicUiConfig>;
  getPublicUiConfigFresh: () => Promise<PublicUiConfig>;
  resolveConfigConsistencyMode: (request: Request) => ConfigConsistencyMode;
};

export function buildGetConfigsLogic(deps: GetConfigsLogicDeps) {
  return async (request: Request) => {
    const configs =
      deps.resolveConfigConsistencyMode(request) === 'fresh'
        ? await deps.getPublicUiConfigFresh()
        : await deps.getPublicUiConfigCached();

    return jsonOk(configs);
  };
}
