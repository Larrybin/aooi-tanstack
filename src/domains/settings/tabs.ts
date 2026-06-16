import { getTranslations } from '@/shared/lib/i18n/native';

import type { Tab } from '@/shared/types/blocks/common';

import { SETTING_TAB_NAMES, type SettingTabName } from './tab-names';

export async function getSettingTabs({
  activeTab,
  availableTabs,
}: {
  activeTab: SettingTabName;
  availableTabs: readonly SettingTabName[];
}) {
  const t = await getTranslations('admin.settings');

  const tabs: Tab[] = SETTING_TAB_NAMES.filter((name) =>
    availableTabs.includes(name)
  ).map((name) => ({
    name,
    title: t(`edit.tabs.${name}`),
    url: `/admin/settings/${name}`,
    is_active: activeTab === name,
  }));

  return tabs;
}
