import {
  checkUserHasAllPermissions,
  checkUserPermission,
} from '@/domains/access-control/application/checker';
import { listAdminApikeysQuery } from '@/domains/account/application/admin-apikeys.query';
import { listAdminCreditsQuery } from '@/domains/account/application/admin-credits.query';
import { getUsers, getUsersCount } from '@/domains/account/infra/user';
import { listAdminAiTasksQuery } from '@/domains/ai/application/admin-ai-tasks.query';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  listAdminPaymentsQuery,
  listAdminSubscriptionsQuery,
} from '@/domains/billing/application/member-billing.query';
import { listAdminChatsQuery } from '@/domains/chat/application/admin-chats.query';
import {
  getPosts,
  getPostsCount,
} from '@/domains/content/application/post.query';
import {
  getTaxonomies,
  getTaxonomiesCount,
} from '@/domains/content/application/taxonomy.query';
import { PostType } from '@/domains/content/domain/post-types';
import { TaxonomyType } from '@/domains/content/domain/taxonomy-types';
import { readAdminSettingsSafe } from '@/domains/settings/application/admin-settings.query';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import {
  readSettingsSafe,
  saveSettings,
} from '@/domains/settings/application/settings-store';
import { mapSettingsToForms } from '@/domains/settings/settings-form-mapper';
import { normalizeSettingOverrides } from '@/domains/settings/settings-normalizers';
import { mergeRegisteredSettingValues } from '@/domains/settings/settings-submit-merge';
import {
  getAvailableSettingTabs,
  getSettingGroups,
  getSettings,
} from '@/domains/settings/site-aware';
import {
  isSettingTabName,
  type SettingTabName,
} from '@/domains/settings/tab-names';
import { getSettingTabs } from '@/domains/settings/tabs';
import {
  listPermissions,
  listRoles,
  listRolesIncludingDeleted,
  readUserPermissionCodes,
} from '@/infra/adapters/access-control/repository';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import {
  AdminAiTasksListQuerySchema,
  AdminApikeysListQuerySchema,
  AdminCategoriesListQuerySchema,
  AdminChatsListQuerySchema,
  AdminCreditsListQuerySchema,
  AdminPaymentsListQuerySchema,
  AdminPostsListQuerySchema,
  AdminRolesListQuerySchema,
  AdminSubscriptionsListQuerySchema,
} from '@/surfaces/admin/schemas/list';
import { getSettingsModuleContractRows } from '@/surfaces/admin/settings/module-contract';

import { defaultLocale, type Locale } from '@/config/locale';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import {
  actionErr,
  actionOk,
  type ActionResult,
} from '@/shared/lib/action/result';
import type { FormField, Form as FormType } from '@/shared/types/blocks/form';

type AdminRouteInput = {
  locale: string;
  splat?: string;
  search?: unknown;
};

type AdminSerializableValue =
  | string
  | number
  | boolean
  | null
  | AdminSerializableValue[]
  | { [key: string]: AdminSerializableValue };

type AdminSettingsFormField = Omit<FormField, 'attributes' | 'metadata'> & {
  attributes?: Record<string, AdminSerializableValue>;
  metadata?: Record<string, AdminSerializableValue>;
};

type AdminSettingsButton = {
  title?: string;
  icon?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

type AdminSettingsForm = {
  title?: string;
  description?: string;
  fields: AdminSettingsFormField[];
  data?: Record<string, AdminSerializableValue>;
  passby?: AdminSerializableValue;
  submit?: {
    input?: AdminSettingsFormField;
    button?: AdminSettingsButton;
    action?: string;
  };
};

type AdminField = {
  name: string;
  title: string;
  group: string;
  value: string;
  type: string;
};

type AdminRow = Record<string, string>;

type AdminTableColumn = {
  key: string;
  title: string;
};

type AdminTablePage = {
  kind: 'table';
  columns: AdminTableColumn[];
  rows: AdminRow[];
  total: number;
  page?: number;
  pageSize?: number;
};

type AdminSettingsUpdateInput = {
  locale: string;
  values: Record<string, string>;
};

type AdminRouteDeps = {
  getCurrentRequest: () => Request;
  readSignedInUser: (request: Request) => Promise<{ id: string } | null>;
  hasAdminAccess: (userId: string) => Promise<boolean>;
  hasAllPermissions: (userId: string, codes: string[]) => Promise<boolean>;
  listUsers: typeof getUsers;
  countUsers: typeof getUsersCount;
  listPayments: typeof listAdminPaymentsQuery;
  listSubscriptions: typeof listAdminSubscriptionsQuery;
  listAiTasks: typeof listAdminAiTasksQuery;
  listApikeys: typeof listAdminApikeysQuery;
  listChats: typeof listAdminChatsQuery;
  listCredits: typeof listAdminCreditsQuery;
  listCategories: typeof getTaxonomies;
  countCategories: typeof getTaxonomiesCount;
  listPosts: typeof getPosts;
  countPosts: typeof getPostsCount;
  listRoles: typeof listRoles;
  listRolesIncludingDeleted: typeof listRolesIncludingDeleted;
  listPermissions: typeof listPermissions;
  readPublicUiConfig: () => Promise<PublicUiConfig>;
};

type AdminSettingsUpdateDeps = Pick<
  AdminRouteDeps,
  | 'getCurrentRequest'
  | 'readSignedInUser'
  | 'hasAdminAccess'
  | 'hasAllPermissions'
> & {
  readSettings: typeof readSettingsSafe;
  saveSettings: typeof saveSettings;
};

export type AdminRouteData =
  | { status: 'not_found' }
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
            forms: AdminSettingsForm[];
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
          }
        | AdminTablePage;
    };

const adminNav = [
  { title: 'Settings', path: '/admin/settings/auth' },
  { title: 'Users', path: '/admin/users' },
  { title: 'API Keys', path: '/admin/apikeys' },
  { title: 'Payments', path: '/admin/payments' },
  { title: 'Subscriptions', path: '/admin/subscriptions' },
  { title: 'Credits', path: '/admin/credits' },
  { title: 'Roles', path: '/admin/roles' },
  { title: 'Permissions', path: '/admin/permissions' },
  { title: 'Categories', path: '/admin/categories' },
  { title: 'Posts', path: '/admin/posts' },
  { title: 'Chats', path: '/admin/chats' },
  { title: 'AI Tasks', path: '/admin/ai-tasks' },
];

function normalizeAdminLocale(value: string): Locale | null {
  return normalizeLocale(value);
}

async function getDefaultAdminRouteDeps(): Promise<AdminRouteDeps> {
  const { getRequest } = await import('@tanstack/react-start/server');

  return {
    getCurrentRequest: getRequest,
    readSignedInUser: getSignedInUserIdentityFromRequest,
    hasAdminAccess: assertAdminAccess,
    hasAllPermissions: assertAdminPermissions,
    listUsers: getUsers,
    countUsers: getUsersCount,
    listPayments: listAdminPaymentsQuery,
    listSubscriptions: listAdminSubscriptionsQuery,
    listAiTasks: listAdminAiTasksQuery,
    listApikeys: listAdminApikeysQuery,
    listChats: listAdminChatsQuery,
    listCredits: listAdminCreditsQuery,
    listCategories: getTaxonomies,
    countCategories: getTaxonomiesCount,
    listPosts: getPosts,
    countPosts: getPostsCount,
    listRoles,
    listRolesIncludingDeleted,
    listPermissions,
    readPublicUiConfig: readPublicUiConfigCached,
  };
}

function parseSearchParams(search: unknown) {
  if (typeof search === 'string') {
    return new URLSearchParams(
      search.startsWith('?') ? search.slice(1) : search
    );
  }

  if (search instanceof URLSearchParams) {
    return new URLSearchParams(search);
  }

  if (search && typeof search === 'object' && !Array.isArray(search)) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(
      search as Record<string, unknown>
    )) {
      appendSearchValue(params, key, value);
    }
    return params;
  }

  return new URLSearchParams();
}

function appendSearchValue(
  params: URLSearchParams,
  key: string,
  value: unknown
) {
  if (Array.isArray(value)) {
    for (const item of value) {
      appendSearchValue(params, key, item);
    }
    return;
  }

  if (value == null) return;
  params.append(key, String(value));
}

function parseSearchObject(search: unknown) {
  const values: Record<string, string> = {};
  for (const [key, value] of parseSearchParams(search)) {
    values[key] ??= value;
  }
  return values;
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

function getAdminPathSegments(currentPath: string) {
  return currentPath.split('/').filter(Boolean).slice(1);
}

function buildAdminNav(locale: string, currentPath: string) {
  return adminNav.map((item) => ({
    title: item.title,
    href: localizeAdminHref(locale, item.path),
    active:
      currentPath === item.path || currentPath.startsWith(`${item.path}/`),
  }));
}

async function assertAdminAccess(userId: string) {
  return checkUserPermission(userId, PERMISSIONS.ADMIN_ACCESS, {
    readUserPermissionCodes,
  });
}

async function assertAdminPermissions(userId: string, codes: string[]) {
  return checkUserHasAllPermissions(userId, codes, {
    readUserPermissionCodes,
  });
}

export async function resolveAdminRouteData(
  input: AdminRouteInput,
  deps?: AdminRouteDeps
): Promise<AdminRouteData> {
  const resolvedDeps = deps ?? (await getDefaultAdminRouteDeps());
  const locale = normalizeAdminLocale(input.locale);
  if (!locale) {
    return { status: 'not_found' };
  }
  const currentPath = routePathFromSplat(input.splat);
  const request = resolvedDeps.getCurrentRequest();
  const user = await resolvedDeps.readSignedInUser(request);

  if (!user) {
    return {
      status: 'unauthenticated',
      redirectTo: buildRedirect(locale, '/sign-in', currentPath),
    };
  }

  if (!(await resolvedDeps.hasAdminAccess(user.id))) {
    return {
      status: 'forbidden',
      redirectTo: localizeAdminHref(locale, '/no-permission'),
    };
  }

  const segments = getAdminPathSegments(currentPath);
  const section = segments[0];
  const isTopLevelSection = segments.length === 1;

  if (currentPath === '/admin' || currentPath === '/admin/') {
    return {
      status: 'ok',
      locale,
      path: currentPath,
      title: 'Admin',
      nav: buildAdminNav(locale, currentPath),
      page: {
        kind: 'overview',
        description:
          'Choose an admin section to manage users, settings, payments, roles, and content.',
      },
    };
  }

  if (section === 'settings') {
    if (segments.length > 2) {
      return { status: 'not_found' };
    }
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_WRITE],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildSettingsPage(locale, currentPath);
  }

  if (section === 'users') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.USERS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildUsersPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'apikeys') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.APIKEYS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildApikeysPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'payments') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.PAYMENTS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildPaymentsPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'subscriptions') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.SUBSCRIPTIONS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildSubscriptionsPage(
      locale,
      currentPath,
      input.search,
      resolvedDeps
    );
  }

  if (section === 'credits') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.CREDITS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildCreditsPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'roles') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.ROLES_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildRolesPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'permissions') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.PERMISSIONS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildPermissionsPage(locale, currentPath, resolvedDeps);
  }

  if (section === 'categories') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.CATEGORIES_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildCategoriesPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'posts') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.POSTS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildPostsPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'chats') {
    if (!isTopLevelSection) return { status: 'not_found' };
    if (!isAiEnabled(await resolvedDeps.readPublicUiConfig())) {
      return { status: 'not_found' };
    }
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.AITASKS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildChatsPage(locale, currentPath, input.search, resolvedDeps);
  }

  if (section === 'ai-tasks') {
    if (!isTopLevelSection) return { status: 'not_found' };
    const denied = await requireAdminSectionPermissions(
      user.id,
      [PERMISSIONS.AITASKS_READ],
      locale,
      resolvedDeps
    );
    if (denied) return denied;
    return buildAiTasksPage(locale, currentPath, input.search, resolvedDeps);
  }

  return { status: 'not_found' };
}

async function requireAdminSectionPermissions(
  userId: string,
  codes: string[],
  locale: Locale,
  deps: Pick<AdminRouteDeps, 'hasAllPermissions'>
): Promise<Extract<AdminRouteData, { status: 'forbidden' }> | null> {
  if (await deps.hasAllPermissions(userId, codes)) {
    return null;
  }

  return {
    status: 'forbidden',
    redirectTo: localizeAdminHref(locale, '/no-permission'),
  };
}

export async function resolveAdminSettingsUpdate(
  input: AdminSettingsUpdateInput,
  deps?: AdminSettingsUpdateDeps
): Promise<ActionResult> {
  const routeDeps = deps ?? {
    ...(await getDefaultAdminRouteDeps()),
    readSettings: readSettingsSafe,
    saveSettings,
  };
  const locale = normalizeAdminLocale(input.locale);
  if (!locale) {
    return actionErr('Admin locale not found');
  }

  const request = routeDeps.getCurrentRequest();
  const user = await routeDeps.readSignedInUser(request);
  if (!user) {
    return actionErr('Sign in required');
  }

  if (!(await routeDeps.hasAdminAccess(user.id))) {
    return actionErr('Admin access required');
  }

  if (
    !(await routeDeps.hasAllPermissions(user.id, [
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_WRITE,
    ]))
  ) {
    return actionErr('Settings permission required');
  }

  const settingsResult = await routeDeps.readSettings();
  if (settingsResult.error) {
    return actionErr(
      'Settings could not be saved because configuration values failed to load. Please try again later.'
    );
  }

  const normalizedOverrides = normalizeSettingOverrides(input.values);
  if (!normalizedOverrides.ok) {
    return actionErr(normalizedOverrides.error);
  }

  const nextConfigs = mergeRegisteredSettingValues({
    initialConfigs: settingsResult.configs,
    values: input.values,
    normalizedOverrides: normalizedOverrides.value,
  });

  await routeDeps.saveSettings(nextConfigs);
  return actionOk('Settings updated');
}

async function buildSettingsPage(
  locale: Locale,
  currentPath: string
): Promise<AdminRouteData> {
  const requestedTab = currentPath.split('/').filter(Boolean)[2];
  const availableTabs = await getAvailableSettingTabs();
  const tab: SettingTabName | null =
    requestedTab === undefined
      ? (availableTabs[0] ?? 'general')
      : isSettingTabName(requestedTab) && availableTabs.includes(requestedTab)
        ? requestedTab
        : null;

  if (!tab) {
    return { status: 'not_found' };
  }

  const [settings, groups, configsResult] = await Promise.all([
    getSettings(),
    getSettingGroups(locale),
    readAdminSettingsSafe(),
  ]);
  const tabs = await getSettingTabs({
    activeTab: tab,
    availableTabs,
    locale,
  });

  const visibleGroups = new Set(
    groups.filter((group) => group.tab === tab).map((group) => group.name)
  );
  const fields = settings
    .filter(
      (setting) => setting.tab === tab && visibleGroups.has(setting.group.id)
    )
    .map((setting) => ({
      name: setting.name,
      title: setting.title,
      group: setting.group.id,
      value:
        configsResult.configs[setting.name] ??
        String('value' in setting ? (setting.value ?? '') : ''),
      type: setting.type,
    }));
  const forms = mapSettingsToForms({
    tab,
    groups,
    settings,
    configs: configsResult.configs,
    submitLabel: 'Save',
  }).map(stripSettingsFormHandler);

  return {
    status: 'ok',
    locale,
    path: currentPath,
    title: `Admin Settings · ${tab}`,
    nav: buildAdminNav(locale, currentPath),
    page: {
      kind: 'settings',
      tab,
      tabs: tabs.map((entry) => ({
        title: entry.title ?? entry.name ?? '',
        href: localizeAdminHref(
          locale,
          entry.url ?? `/admin/settings/${entry.name ?? tab}`
        ),
        active: Boolean(entry.is_active),
      })),
      fields,
      forms,
      moduleContracts: getSettingsModuleContractRows(tab),
      loadError: configsResult.error?.message,
    },
  };
}

function stripSettingsFormHandler(form: FormType): AdminSettingsForm {
  return {
    title: form.title,
    description: form.description,
    fields: form.fields.map(toAdminSettingsFormField),
    data: toSerializableRecord(form.data),
    passby: toSerializableValue(form.passby),
    submit: form.submit
      ? {
          input: form.submit.input
            ? toAdminSettingsFormField(form.submit.input)
            : undefined,
          button: toAdminSettingsButton(form.submit.button),
          action: form.submit.action,
        }
      : undefined,
  };
}

function toAdminSettingsFormField(field: FormField): AdminSettingsFormField {
  const { attributes, metadata, ...rest } = field;
  return {
    ...rest,
    attributes: toSerializableRecord(attributes),
    metadata: toSerializableRecord(metadata),
  };
}

function toAdminSettingsButton(
  button: NonNullable<FormType['submit']>['button']
): AdminSettingsButton | undefined {
  if (!button) return undefined;

  return {
    title: button.title,
    icon: typeof button.icon === 'string' ? button.icon : undefined,
    variant: button.variant,
    size: button.size,
  };
}

function toSerializableRecord(
  value: unknown
): Record<string, AdminSerializableValue> | undefined {
  const serialized = toSerializableValue(value);
  return serialized &&
    !Array.isArray(serialized) &&
    typeof serialized === 'object'
    ? (serialized as Record<string, AdminSerializableValue>)
    : undefined;
}

function toSerializableValue(
  value: unknown
): AdminSerializableValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => toSerializableValue(item))
      .filter((item): item is AdminSerializableValue => item !== undefined);
  }
  if (typeof value === 'object') {
    const record: Record<string, AdminSerializableValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const serialized = toSerializableValue(item);
      if (serialized !== undefined) {
        record[key] = serialized;
      }
    }
    return record;
  }
  return String(value);
}

async function buildUsersPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listUsers' | 'countUsers'>
): Promise<AdminRouteData> {
  const params = parseSearchParams(search);
  const page = Math.max(1, Number(params.get('page') || '1') || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(params.get('limit') || '30') || 30)
  );
  const email = params.get('email')?.trim() || undefined;
  const [rows, total] = await Promise.all([
    deps.listUsers({ page, limit, email }),
    deps.countUsers({ email }),
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
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : String(row.createdAt),
      })),
    },
  };
}

async function buildApikeysPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listApikeys'>
): Promise<AdminRouteData> {
  const query = AdminApikeysListQuerySchema.parse(parseSearchObject(search));
  const { rows, total } = await deps.listApikeys({
    page: query.page,
    limit: query.pageSize,
  });

  return buildTableRouteData(locale, currentPath, 'Admin API Keys', {
    columns: [
      { key: 'title', title: 'Title' },
      { key: 'key', title: 'Key' },
      { key: 'user', title: 'User' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        title: toAdminCell(record.title),
        key: toAdminCell(record.key),
        user: readUserLabel(record),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildPaymentsPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listPayments'>
): Promise<AdminRouteData> {
  const query = AdminPaymentsListQuerySchema.parse(parseSearchObject(search));
  const { rows, total } = await deps.listPayments({
    page: query.page,
    limit: query.pageSize,
    orderNo: query.orderNo,
    paymentType: query.type,
    paymentProvider: query.provider,
    status: query.status,
  });

  return buildTableRouteData(locale, currentPath, 'Admin Payments', {
    columns: [
      { key: 'orderNo', title: 'Order' },
      { key: 'user', title: 'User' },
      { key: 'status', title: 'Status' },
      { key: 'paymentType', title: 'Type' },
      { key: 'paymentProvider', title: 'Provider' },
      { key: 'amount', title: 'Amount' },
      { key: 'currency', title: 'Currency' },
      { key: 'createdAt', title: 'Created' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        orderNo: toAdminCell(record.orderNo),
        user: readUserLabel(record),
        status: toAdminCell(record.status),
        paymentType: toAdminCell(record.paymentType),
        paymentProvider: toAdminCell(record.paymentProvider),
        amount: toAdminCell(record.paymentAmount ?? record.amount),
        currency: toAdminCell(record.paymentCurrency ?? record.currency),
        createdAt: toAdminCell(record.createdAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildSubscriptionsPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listSubscriptions'>
): Promise<AdminRouteData> {
  const query = AdminSubscriptionsListQuerySchema.parse(
    parseSearchObject(search)
  );
  const { rows, total } = await deps.listSubscriptions({
    page: query.page,
    limit: query.pageSize,
    interval: query.interval,
  });

  return buildTableRouteData(locale, currentPath, 'Admin Subscriptions', {
    columns: [
      { key: 'subscriptionNo', title: 'Subscription' },
      { key: 'user', title: 'User' },
      { key: 'amount', title: 'Amount' },
      { key: 'interval', title: 'Interval' },
      { key: 'paymentProvider', title: 'Provider' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
      { key: 'currentPeriodEnd', title: 'Period End' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        subscriptionNo: toAdminCell(record.subscriptionNo),
        user: readUserLabel(record),
        amount: toAdminCell(record.amount),
        interval: toAdminCell(record.interval),
        paymentProvider: toAdminCell(record.paymentProvider),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
        currentPeriodEnd: toAdminCell(record.currentPeriodEnd),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildCreditsPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listCredits'>
): Promise<AdminRouteData> {
  const query = AdminCreditsListQuerySchema.parse(parseSearchObject(search));
  const { rows, total } = await deps.listCredits({
    page: query.page,
    limit: query.pageSize,
    transactionType: query.type,
  });

  return buildTableRouteData(locale, currentPath, 'Admin Credits', {
    columns: [
      { key: 'transactionNo', title: 'Transaction' },
      { key: 'user', title: 'User' },
      { key: 'credits', title: 'Credits' },
      { key: 'remainingCredits', title: 'Remaining' },
      { key: 'transactionType', title: 'Type' },
      { key: 'transactionScene', title: 'Scene' },
      { key: 'createdAt', title: 'Created' },
      { key: 'expiresAt', title: 'Expires' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        transactionNo: toAdminCell(record.transactionNo),
        user: readUserLabel(record),
        credits: toAdminCell(record.credits),
        remainingCredits: toAdminCell(record.remainingCredits),
        transactionType: toAdminCell(record.transactionType),
        transactionScene: toAdminCell(record.transactionScene),
        createdAt: toAdminCell(record.createdAt),
        expiresAt: toAdminCell(record.expiresAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildRolesPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listRoles' | 'listRolesIncludingDeleted'>
): Promise<AdminRouteData> {
  const query = AdminRolesListQuerySchema.parse(parseSearchObject(search));
  const rows = query.includeDeleted
    ? await deps.listRolesIncludingDeleted()
    : await deps.listRoles();

  return buildTableRouteData(locale, currentPath, 'Admin Roles', {
    columns: [
      { key: 'name', title: 'Name' },
      { key: 'title', title: 'Title' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
      { key: 'deletedAt', title: 'Deleted' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        name: toAdminCell(record.name),
        title: toAdminCell(record.title),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
        deletedAt: toAdminCell(record.deletedAt),
      };
    }),
    total: rows.length,
  });
}

async function buildPermissionsPage(
  locale: string,
  currentPath: string,
  deps: Pick<AdminRouteDeps, 'listPermissions'>
): Promise<AdminRouteData> {
  const rows = await deps.listPermissions();

  return buildTableRouteData(locale, currentPath, 'Admin Permissions', {
    columns: [
      { key: 'code', title: 'Code' },
      { key: 'title', title: 'Title' },
      { key: 'resource', title: 'Resource' },
      { key: 'action', title: 'Action' },
      { key: 'createdAt', title: 'Created' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        code: toAdminCell(record.code),
        title: toAdminCell(record.title),
        resource: toAdminCell(record.resource),
        action: toAdminCell(record.action),
        createdAt: toAdminCell(record.createdAt),
      };
    }),
    total: rows.length,
  });
}

async function buildCategoriesPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listCategories' | 'countCategories'>
): Promise<AdminRouteData> {
  const query = AdminCategoriesListQuerySchema.parse(parseSearchObject(search));
  const [rows, total] = await Promise.all([
    deps.listCategories({
      type: TaxonomyType.CATEGORY,
      page: query.page,
      limit: query.pageSize,
    }),
    deps.countCategories({ type: TaxonomyType.CATEGORY }),
  ]);

  return buildTableRouteData(locale, currentPath, 'Admin Categories', {
    columns: [
      { key: 'slug', title: 'Slug' },
      { key: 'title', title: 'Title' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
      { key: 'updatedAt', title: 'Updated' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        slug: toAdminCell(record.slug),
        title: toAdminCell(record.title),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
        updatedAt: toAdminCell(record.updatedAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildPostsPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listPosts' | 'countPosts'>
): Promise<AdminRouteData> {
  const query = AdminPostsListQuerySchema.parse(parseSearchObject(search));
  const [rows, total] = await Promise.all([
    deps.listPosts({
      type: PostType.ARTICLE,
      page: query.page,
      limit: query.pageSize,
    }),
    deps.countPosts({ type: PostType.ARTICLE }),
  ]);

  return buildTableRouteData(locale, currentPath, 'Admin Posts', {
    columns: [
      { key: 'title', title: 'Title' },
      { key: 'authorName', title: 'Author' },
      { key: 'image', title: 'Image' },
      { key: 'categories', title: 'Categories' },
      { key: 'createdAt', title: 'Created' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        title: toAdminCell(record.title),
        authorName: toAdminCell(record.authorName),
        image: toAdminCell(record.image),
        categories: toAdminCell(record.categories),
        createdAt: toAdminCell(record.createdAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildChatsPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listChats'>
): Promise<AdminRouteData> {
  const query = AdminChatsListQuerySchema.parse(parseSearchObject(search));
  const { rows, total } = await deps.listChats({
    page: query.page,
    limit: query.pageSize,
  });

  return buildTableRouteData(locale, currentPath, 'Admin Chats', {
    columns: [
      { key: 'title', title: 'Title' },
      { key: 'user', title: 'User' },
      { key: 'status', title: 'Status' },
      { key: 'model', title: 'Model' },
      { key: 'provider', title: 'Provider' },
      { key: 'createdAt', title: 'Created' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        title: toAdminCell(record.title),
        user: readUserLabel(record),
        status: toAdminCell(record.status),
        model: toAdminCell(record.model),
        provider: toAdminCell(record.provider),
        createdAt: toAdminCell(record.createdAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

async function buildAiTasksPage(
  locale: string,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listAiTasks'>
): Promise<AdminRouteData> {
  const query = AdminAiTasksListQuerySchema.parse(parseSearchObject(search));
  const { rows, total } = await deps.listAiTasks({
    page: query.page,
    limit: query.pageSize,
    mediaType: query.type,
  });

  return buildTableRouteData(locale, currentPath, 'Admin AI Tasks', {
    columns: [
      { key: 'id', title: 'ID' },
      { key: 'user', title: 'User' },
      { key: 'mediaType', title: 'Media' },
      { key: 'provider', title: 'Provider' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      return {
        id: toAdminCell(record.id),
        user: readUserLabel(record),
        mediaType: toAdminCell(record.mediaType),
        provider: toAdminCell(record.provider),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
      };
    }),
    total,
    page: query.page,
    pageSize: query.pageSize,
  });
}

function buildTableRouteData(
  locale: string,
  currentPath: string,
  title: string,
  page: Omit<AdminTablePage, 'kind'>
): Extract<AdminRouteData, { status: 'ok' }> {
  return {
    status: 'ok',
    locale,
    path: currentPath,
    title,
    nav: buildAdminNav(locale, currentPath),
    page: { kind: 'table', ...page },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function readUserLabel(record: Record<string, unknown>) {
  const user = asRecord(record.user);
  return (
    toAdminCell(user.email) ||
    toAdminCell(user.name) ||
    toAdminCell(record.userEmail) ||
    toAdminCell(record.userId)
  );
}

function toAdminCell(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
