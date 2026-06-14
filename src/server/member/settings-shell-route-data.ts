import type { SettingsShellNavItem } from '@/surfaces/member/settings-shell/settings-shell.types';

import { localePath } from '@/shared/i18n/locale';

export const migratedSettingsPaths = [
  '/settings/profile',
  '/settings/security',
  '/settings/credits',
  '/settings/billing',
  '/settings/payments',
  '/settings/apikeys',
] as const;

type MigratedSettingsPath = (typeof migratedSettingsPaths)[number];

export function buildSettingsShellNavItems({
  activePath,
  locale,
  sidebar,
}: {
  activePath: MigratedSettingsPath;
  locale: string;
  sidebar: Record<string, unknown>;
}): SettingsShellNavItem[] {
  const sidebarItems = Array.isArray(getObject(sidebar.nav).items)
    ? (getObject(sidebar.nav).items as Array<Record<string, unknown>>)
    : [];

  return migratedSettingsPaths.map((path) => {
    const item = sidebarItems.find((entry) => entry.url === path) ?? {};

    return {
      title: readString(item.title, fallbackTitleForPath(path)),
      url: localePath(path, locale),
      icon: readOptionalString(item.icon),
      active: path === activePath,
    };
  });
}

function fallbackTitleForPath(path: MigratedSettingsPath) {
  if (path === '/settings/profile') {
    return 'Profile';
  }

  if (path === '/settings/security') {
    return 'Security';
  }

  if (path === '/settings/credits') {
    return 'Credits';
  }

  if (path === '/settings/billing') {
    return 'Billing';
  }

  if (path === '/settings/payments') {
    return 'Payments';
  }

  return 'API Keys';
}

function readString(value: unknown, fallback: string) {
  return typeof value === 'string' && value ? value : fallback;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

function getObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
