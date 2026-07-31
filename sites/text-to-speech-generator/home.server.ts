import { resolveTextToSpeechGeneratorHomeCopy } from '@/domains/text-to-speech-generator/ui/text-to-speech-home-copy';
import { getServerPublicEnvConfigs } from '@/infra/runtime/env.server';
import { siteHomeContent } from '@/site';

import type { SiteProductHomeRouteData } from './home';

export function resolveSiteProductHomeRouteData(
  locale: string
): SiteProductHomeRouteData | null {
  if (!(siteHomeContent as Readonly<Record<string, unknown>>)[locale])
    return null;

  return {
    copy: resolveTextToSpeechGeneratorHomeCopy(siteHomeContent, locale),
    turnstileSiteKey: getServerPublicEnvConfigs().turnstileSiteKey,
  };
}
