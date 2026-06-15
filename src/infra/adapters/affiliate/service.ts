
import type { AffiliateRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { readAffiliateRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';

import {
  AffiliateManager,
  AffonsoAffiliateProvider,
  PromoteKitAffiliateProvider,
} from '@/extensions/affiliate';

export function createAffiliateManager(settings: AffiliateRuntimeSettings) {
  const affiliateManager = new AffiliateManager();

  if (settings.affonsoEnabled && settings.affonsoId) {
    affiliateManager.addProvider(
      new AffonsoAffiliateProvider({
        affonsoId: settings.affonsoId,
        cookieDuration: settings.affonsoCookieDuration,
      })
    );
  }

  if (settings.promotekitEnabled && settings.promotekitId) {
    affiliateManager.addProvider(
      new PromoteKitAffiliateProvider({
        promotekitId: settings.promotekitId,
      })
    );
  }

  return affiliateManager;
}

export async function getAffiliateService(): Promise<AffiliateManager> {
  return createAffiliateManager(await readAffiliateRuntimeSettingsCached());
}
