
import type { AnalyticsRuntimeSettings } from '@/domains/settings/application/settings-runtime.contracts';
import { readAnalyticsRuntimeSettingsCached } from '@/domains/settings/application/settings-runtime.query';

import {
  AnalyticsManager,
  ClarityAnalyticsProvider,
  GoogleAnalyticsProvider,
  OpenPanelAnalyticsProvider,
  PlausibleAnalyticsProvider,
} from '@/extensions/analytics';

export function createAnalyticsManager(settings: AnalyticsRuntimeSettings) {
  const analytics = new AnalyticsManager();

  if (settings.googleAnalyticsId) {
    analytics.addProvider(
      new GoogleAnalyticsProvider({ gaId: settings.googleAnalyticsId })
    );
  }

  if (settings.clarityId) {
    analytics.addProvider(
      new ClarityAnalyticsProvider({ clarityId: settings.clarityId })
    );
  }

  if (settings.plausibleDomain && settings.plausibleSrc) {
    analytics.addProvider(
      new PlausibleAnalyticsProvider({
        domain: settings.plausibleDomain,
        src: settings.plausibleSrc,
      })
    );
  }

  if (settings.openpanelClientId) {
    analytics.addProvider(
      new OpenPanelAnalyticsProvider({
        clientId: settings.openpanelClientId,
      })
    );
  }

  return analytics;
}

export async function getAnalyticsService(): Promise<AnalyticsManager> {
  return createAnalyticsManager(await readAnalyticsRuntimeSettingsCached());
}
