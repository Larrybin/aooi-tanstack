import type { Locale } from '@/config/locale';
import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { getTranslations } from '@/shared/lib/i18n/native';

import { ALL_SETTINGS, getSettingGroupsFromDefinitions } from './registry';
import type { SettingTabName } from './tab-names';

function filterSiteAwarePaymentSettings() {
  const paymentCapability = resolveSitePaymentCapability();

  return ALL_SETTINGS.filter((setting) => {
    if (setting.tab !== 'payment') {
      return true;
    }

    if (paymentCapability === 'none') {
      return false;
    }

    return setting.group.id === paymentCapability;
  });
}

export async function getSettings() {
  return filterSiteAwarePaymentSettings();
}

export async function getSettingGroups(locale?: Locale) {
  const settings = await getSettings();
  const t = await getTranslations('admin.settings', locale);
  return getSettingGroupsFromDefinitions(settings, (key) => t(key));
}

export async function getAvailableSettingTabs(): Promise<SettingTabName[]> {
  const settings = await getSettings();
  return [
    ...new Set(settings.map((setting) => setting.tab)),
  ] as SettingTabName[];
}
