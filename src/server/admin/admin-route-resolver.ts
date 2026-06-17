import { checkUserPermission } from '@/domains/access-control/application/checker';
import { getUsers, getUsersCount } from '@/domains/account/infra/user';
import { readAdminSettingsSafe } from '@/domains/settings/application/admin-settings.query';
import { getAvailableSettingTabs, getSettingGroups, getSettings } from '@/domains/settings/site-aware';
import { isSettingTabName, type SettingTabName } from '@/domains/settings/tab-names';
import { getSettingsModuleContractRows } from '@/surfaces/admin/settings/module-contract';
import { readUserPermissionCodes } from '@/infra/adapters/access-control/repository';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { getRequest } from '@tanstack/react-start/server';

import { defaultLocale } from '@/config/locale';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

type AdminRouteInput = {
  locale: string;
  splat?: string;
  search?: unknown;
};

type AdminField = {
  name: string;
  title: string;
  group: string;
  value: string;
  type: string;
};

type AdminRow = Record<string, string>;

export type AdminRouteData =
  | { status: 'unauthenticated'; redirectTo: string }
  | { status: 'forbidden'; redirectTo: string }
  | {
      status: 'ok';
      locale: string;
      path: string;
      title: string;
      nav: Array<{ title: string; href: string; active: boolean }>;
      page:
        | {
            kind: 'settings';
            tab: string;
            tabs: Array<{ title: string; href: string; active: boolean }>;
            fields: AdminField[];
            moduleContracts: Array<{
              moduleId: string;
              title: string;
              relationship: string;
              tier: string;
              verification: string;
              guideHref: string;
            }>;
            loadError?: string;
          }
        | {
            kind: 'users';
            rows: AdminRow[];
            total: number;
          }
        | {
            kind: 'overview';
            description: string;
          };
    };

const adminNav = [
  { title: 'Settings', path: '/admin/settings/auth' },
  { title: 'Users', path: '/admin/users' },
  { title: 'Payments', path: '/admin/payments' },
  { title: 'Roles', path: '/admin/roles' },
  { title: 'Permissions', path: '/admin/permissions' },
  { title: 'AI Tasks', path: '/admin/ai-tasks' },
];

function normalizeAdminLocale(value: string) {
  return normalizeLocale(value) ?? defaultLocale;
}

function parseSearch(search: unknown) {
  const raw = typeof search === 'string' ? search : '';
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
}

function localizeAdminHref(locale: string, path: string) {
  return locale === defaultLocale ? path : localePath(path, locale);
}

function buildRedirect(locale: string, path: string, callbackPath?: string) {
  const url = localizeAdminHref(locale, path);
  if (!callbackPath) return url;
  return `${url}?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

function routePathFromSplat(splat: string | undefined) {
  const normalized = (splat ?? '').replace(/^\/+|\/+$/g, '');
  return normalized ? `/admin/${normalized}` : '/admin';
}

function buildAdminNav(locale: string, currentPath: string) {
  return adminNav.map((item) => ({
    title: item.title,
    href: localizeAdminHref(locale, item.path),
    active: currentPath === item.path || currentPath.startsWith(`${item.path}/`),
  }));
}

async function assertAdminAccess(userId: string) {
  return checkUserPermission(userId, PERMISSIONS.ADMIN_ACCESS, {
    readUserPermissionCodes,
  });
}

export async function resolveAdminRouteData(
  input: AdminRouteInput
): Promise<AdminRouteData> {
  const locale = normalizeAdminLocale(input.locale);
  const currentPath = routePathFromSplat(input.splat);
  const request = getRequest();
  const user = await getSignedInUserIdentityFromRequest(request);

  if (!user) {
    return {
      status: 'unauthenticated',
      redirectTo: buildRedirect(locale, '/sign-in', currentPath),
    };
  }

  if (!(await assertAdminAccess(user.id))) {
    return {
      status: 'forbidden',
      redirectTo: localizeAdminHref(locale, '/no-permission'),
    };
  }

  if (currentPath === '/admin' || currentPath === '/admin/') {
    return {
      status: 'ok',
      locale,
      path: currentPath,
      title: 'Admin',
      nav: buildAdminNav(locale, currentPath),
      page: {
        kind: 'overview',
        description: 'Choose an admin section to manage users, settings, payments, roles, and content.',
      },
    };
  }

  if (currentPath.startsWith('/admin/settings')) {
    return buildSettingsPage(locale, currentPath);
  }

  if (currentPath === '/admin/users' || currentPath.startsWith('/admin/users/')) {
    return buildUsersPage(locale, currentPath, input.search);
  }

  return {
    status: 'ok',
    locale,
    path: currentPath,
    title: `Admin · ${currentPath.replace(/^\/admin\/?/, '') || 'Overview'}`,
    nav: buildAdminNav(locale, currentPath),
    page: {
      kind: 'overview',
      description: 'This admin section is available in the native TanStack admin worker route. Detailed table actions continue to use the domain APIs and server routes as they are migrated.',
    },
  };
}

async function buildSettingsPage(
  locale: string,
  currentPath: string
): Promise<AdminRouteData> {
  const requestedTab = currentPath.split('/').filter(Boolean)[2] ?? 'auth';
  const availableTabs = await getAvailableSettingTabs();
  const tab: SettingTabName =
    isSettingTabName(requestedTab) && availableTabs.includes(requestedTab)
      ? requestedTab
      : availableTabs[0] ?? 'general';
  const [settings, groups, configsResult] = await Promise.all([
    getSettings(),
    getSettingGroups(),
    readAdminSettingsSafe(),
  ]);

  const visibleGroups = new Set(
    groups.filter((group) => group.tab === tab).map((group) => group.name)
  );
  const fields = settings
    .filter((setting) => setting.tab === tab && visibleGroups.has(setting.group.id))
    .map((setting) => ({
      name: setting.name,
      title: setting.title,
      group: setting.group.id,
      value: configsResult.configs[setting.name] ?? String('value' in setting ? (setting.value ?? '') : ''),
      type: setting.type,
    }));

  return {
    status: 'ok',
    locale,
    path: currentPath,
    title: `Admin Settings · ${tab}`,
    nav: buildAdminNav(locale, currentPath),
    page: {
      kind: 'settings',
      tab,
      tabs: availableTabs.map((entry) => ({
        title: entry,
        href: localizeAdminHref(locale, `/admin/settings/${entry}`),
        active: entry === tab,
      })),
      fields,
      moduleContracts: getSettingsModuleContractRows(tab),
      loadError: configsResult.error?.message,
    },
  };
}

async function buildUsersPage(
  locale: string,
  currentPath: string,
  search: unknown
): Promise<AdminRouteData> {
  const params = parseSearch(search);
  const page = Math.max(1, Number(params.get('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get('limit') || '30') || 30));
  const email = params.get('email')?.trim() || undefined;
  const [rows, total] = await Promise.all([
    getUsers({ page, limit, email }),
    getUsersCount({ email }),
  ]);

  return {
    status: 'ok',
    locale,
    path: currentPath,
    title: 'Admin Users',
    nav: buildAdminNav(locale, currentPath),
    page: {
      kind: 'users',
      total,
      rows: rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: String(row.emailVerified),
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      })),
    },
  };
}
