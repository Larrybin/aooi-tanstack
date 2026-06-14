import {
  readPublicUiConfigCached,
  readPublicUiConfigFresh,
} from '@/domains/settings/application/settings-runtime.query';

import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';

import { buildGetConfigsLogic } from '@/server/api/config/get-configs-logic';

const defaultGetConfigsLogic = buildGetConfigsLogic({
  getPublicUiConfigCached: readPublicUiConfigCached,
  getPublicUiConfigFresh: readPublicUiConfigFresh,
  resolveConfigConsistencyMode,
});

export const GET = withApi(defaultGetConfigsLogic);
export const POST = withApi(defaultGetConfigsLogic);
