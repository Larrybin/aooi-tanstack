import {
  readAdminRolePermissionsQuery,
  readAdminRoleQuery,
} from '@/domains/access-control/application/admin-roles.query';
import {
  checkUserHasAllPermissions,
  checkUserPermission,
  deleteRoleUseCase,
  readAdminUserRoleOptionsUseCase,
  replaceRolePermissionsUseCase,
  restoreRoleUseCase,
  updateRoleMetadataUseCase,
  type AccessControlPermissionRecord,
  type AccessControlRoleRecord,
} from '@/domains/access-control/application/checker';
import { listAdminApikeysQuery } from '@/domains/account/application/admin-apikeys.query';
import { listAdminCreditsQuery } from '@/domains/account/application/admin-credits.query';
import { readAdminUserQuery } from '@/domains/account/application/admin-user.query';
import {
  findUserById,
  getUsers,
  getUsersCount,
  updateUser,
} from '@/domains/account/infra/user';
import { listAdminAiTasksQuery } from '@/domains/ai/application/admin-ai-tasks.query';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  buildPaymentReplayReturnPath,
  executeAdminPaymentReplay,
  getPaymentReplayPreviewLabel,
  listAdminPaymentReplayPreview,
  parsePaymentReplayDateTime,
  PAYMENT_WEBHOOK_INBOX_STATUS,
  PAYMENT_WEBHOOK_OPERATION_KIND,
} from '@/domains/billing/application/admin-payment-replay';
import {
  listAdminPaymentsQuery,
  listAdminSubscriptionsQuery,
} from '@/domains/billing/application/member-billing.query';
import { listAdminChatsQuery } from '@/domains/chat/application/admin-chats.query';
import {
  addPost,
  updatePost,
  type NewPost,
} from '@/domains/content/application/post-management';
import {
  findPost,
  getPosts,
  getPostsCount,
} from '@/domains/content/application/post.query';
import {
  addTaxonomy,
  updateTaxonomy,
  type NewTaxonomy,
} from '@/domains/content/application/taxonomy-management';
import {
  findTaxonomy,
  getTaxonomies,
  getTaxonomiesCount,
} from '@/domains/content/application/taxonomy.query';
import { PostStatus, PostType } from '@/domains/content/domain/post-types';
import {
  TaxonomyStatus,
  TaxonomyType,
} from '@/domains/content/domain/taxonomy-types';
import {
  readAdminSettingsSafe,
  saveAdminSettingsValues,
} from '@/domains/settings/application/admin-settings.query';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import { mapSettingsToForms } from '@/domains/settings/settings-form-mapper';
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
  findRoleById as findActiveRoleById,
  findRoleByIdIncludingDeleted,
  listPermissions,
  listRolePermissions,
  listRoles,
  listRolesIncludingDeleted,
  listUserRoles,
  readUserPermissionCodes,
  replaceRolePermissions,
  replaceUserRoles,
  restoreRoleRecord,
  softDeleteRole,
  updateRoleRecord,
} from '@/infra/adapters/access-control/repository';
import { getSignedInUserIdentityFromRequest } from '@/infra/platform/auth/session-by-request';
import { AdminCategoryFormSchema } from '@/surfaces/admin/schemas/category';
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
import { AdminPostFormSchema } from '@/surfaces/admin/schemas/post';
import { AdminRoleUpdateFormSchema } from '@/surfaces/admin/schemas/role';
import { AdminUserUpdateFormSchema } from '@/surfaces/admin/schemas/user';
import { getSettingsModuleContractRows } from '@/surfaces/admin/settings/module-contract';
import { z } from 'zod';

import { defaultLocale, type Locale } from '@/config/locale';
import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { localePath, normalizeLocale } from '@/shared/i18n/locale';
import { jsonStringArraySchema, parseFormData } from '@/shared/lib/action/form';
import {
  actionErr,
  actionOk,
  type ActionResult,
} from '@/shared/lib/action/result';
import { getUuid } from '@/shared/lib/hash';
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
  actions?: Array<{ title: string; href: string }>;
};

type AdminSettingsUpdateInput = {
  locale: string;
  values: Record<string, string>;
};

type AdminActionInput = {
  locale: string;
  action: string;
  id?: string;
  values: Record<string, string>;
};

type AdminPaymentReplayRow = {
  id: string;
  provider: string;
  status: string;
  label: string;
  eventId: string;
  eventType: string;
  receivedAt: string;
  attempts: string;
  lastError: string;
  executable: boolean;
};

type AdminPaymentReplayStatus =
  | 'all'
  | (typeof PAYMENT_WEBHOOK_INBOX_STATUS)[keyof typeof PAYMENT_WEBHOOK_INBOX_STATUS];

type AdminPaymentReplayPage = {
  kind: 'payment_replay';
  filters: {
    provider: string;
    eventId: string;
    status: string;
    operationKind: string;
    receivedFrom: string;
    receivedTo: string;
  };
  previewEnabled: boolean;
  rows: AdminPaymentReplayRow[];
  executableIds: string[];
  returnPath: string;
  executedMessage?: string;
  errorMessage?: string;
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
  findUserById: typeof findUserById;
  updateUser: typeof updateUser;
  listRoles: (args?: {
    includeDeleted?: boolean;
  }) => Promise<AccessControlRoleRecord[]>;
  listRolesIncludingDeleted: typeof listRolesIncludingDeleted;
  listPermissions: typeof listPermissions;
  findRoleById: (
    roleId: string,
    args?: { includeDeleted?: boolean }
  ) => Promise<AccessControlRoleRecord | undefined>;
  listRolePermissions: (
    roleId: string
  ) => Promise<AccessControlPermissionRecord[]>;
  listUserRolesDetailed: (
    userId: string
  ) => Promise<Array<{ id: string; title?: string | null }>>;
  updateRoleRecord: typeof updateRoleRecord;
  replaceRolePermissions: typeof replaceRolePermissions;
  softDeleteRole: typeof softDeleteRole;
  restoreRoleRecord: typeof restoreRoleRecord;
  replaceUserRoles: typeof replaceUserRoles;
  findTaxonomy: typeof findTaxonomy;
  addTaxonomy: typeof addTaxonomy;
  updateTaxonomy: typeof updateTaxonomy;
  findPost: typeof findPost;
  addPost: typeof addPost;
  updatePost: typeof updatePost;
  createId: typeof getUuid;
  resolvePaymentCapability: typeof resolveSitePaymentCapability;
  listPaymentReplayPreview: typeof listAdminPaymentReplayPreview;
  executePaymentReplay: typeof executeAdminPaymentReplay;
  readPublicUiConfig: () => Promise<PublicUiConfig>;
};

type AdminSettingsUpdateDeps = Pick<
  AdminRouteDeps,
  | 'getCurrentRequest'
  | 'readSignedInUser'
  | 'hasAdminAccess'
  | 'hasAllPermissions'
> & {
  saveSettingsValues: typeof saveAdminSettingsValues;
};

type AdminActionDeps = Pick<
  AdminRouteDeps,
  | 'getCurrentRequest'
  | 'readSignedInUser'
  | 'hasAdminAccess'
  | 'hasAllPermissions'
  | 'findUserById'
  | 'updateUser'
  | 'findRoleById'
  | 'listRoles'
  | 'listPermissions'
  | 'listRolePermissions'
  | 'listUserRolesDetailed'
  | 'updateRoleRecord'
  | 'replaceRolePermissions'
  | 'softDeleteRole'
  | 'restoreRoleRecord'
  | 'replaceUserRoles'
  | 'findTaxonomy'
  | 'addTaxonomy'
  | 'updateTaxonomy'
  | 'findPost'
  | 'addPost'
  | 'updatePost'
  | 'createId'
  | 'resolvePaymentCapability'
  | 'executePaymentReplay'
>;

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
        | {
            kind: 'form';
            form: AdminSettingsForm;
            backHref: string;
          }
        | AdminPaymentReplayPage
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
    findUserById,
    updateUser,
    listRoles: async (args) =>
      args?.includeDeleted ? listRolesIncludingDeleted() : listRoles(),
    listRolesIncludingDeleted,
    listPermissions,
    findRoleById: async (roleId, args) =>
      args?.includeDeleted
        ? findRoleByIdIncludingDeleted(roleId)
        : findActiveRoleById(roleId),
    listRolePermissions,
    listUserRolesDetailed: listUserRoles,
    updateRoleRecord,
    replaceRolePermissions,
    softDeleteRole,
    restoreRoleRecord,
    replaceUserRoles,
    findTaxonomy,
    addTaxonomy,
    updateTaxonomy,
    findPost,
    addPost,
    updatePost,
    createId: getUuid,
    resolvePaymentCapability: resolveSitePaymentCapability,
    listPaymentReplayPreview: listAdminPaymentReplayPreview,
    executePaymentReplay: executeAdminPaymentReplay,
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

function localizeReturnPath(locale: string, path: string) {
  if (!path.startsWith('/admin')) return path;
  return localizeAdminHref(locale, path);
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
    if (isTopLevelSection) {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.USERS_READ],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildUsersPage(locale, currentPath, input.search, resolvedDeps);
    }

    if (segments.length === 3 && segments[2] === 'edit') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.USERS_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildUserEditPage(locale, currentPath, segments[1], resolvedDeps);
    }

    if (segments.length === 3 && segments[2] === 'edit-roles') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.USERS_WRITE, PERMISSIONS.ROLES_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildUserRolesPage(locale, currentPath, segments[1], resolvedDeps);
    }

    return { status: 'not_found' };
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
    if (isTopLevelSection) {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.PAYMENTS_READ],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildPaymentsPage(locale, currentPath, input.search, resolvedDeps);
    }

    if (segments.length === 2 && segments[1] === 'replay') {
      if (resolvedDeps.resolvePaymentCapability() === 'none') {
        return { status: 'not_found' };
      }
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.PAYMENTS_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildPaymentReplayPage(
        locale,
        currentPath,
        input.search,
        resolvedDeps
      );
    }

    return { status: 'not_found' };
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
    if (isTopLevelSection) {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.ROLES_READ],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildRolesPage(locale, currentPath, input.search, resolvedDeps);
    }

    if (segments.length === 3 && segments[2] === 'edit') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.ROLES_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildRoleEditPage(locale, currentPath, segments[1], resolvedDeps);
    }

    if (segments.length === 3 && segments[2] === 'edit-permissions') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.ROLES_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildRolePermissionsPage(
        locale,
        currentPath,
        segments[1],
        resolvedDeps
      );
    }

    if (segments.length === 3 && segments[2] === 'delete') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.ROLES_DELETE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildRoleDeletePage(
        locale,
        currentPath,
        segments[1],
        resolvedDeps
      );
    }

    if (segments.length === 3 && segments[2] === 'restore') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.ROLES_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildRoleRestorePage(
        locale,
        currentPath,
        segments[1],
        resolvedDeps
      );
    }

    return { status: 'not_found' };
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
    if (isTopLevelSection) {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.CATEGORIES_READ],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildCategoriesPage(
        locale,
        currentPath,
        input.search,
        resolvedDeps
      );
    }

    if (segments.length === 2 && segments[1] === 'add') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.CATEGORIES_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildCategoryAddPage(locale, currentPath);
    }

    if (segments.length === 3 && segments[2] === 'edit') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.CATEGORIES_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildCategoryEditPage(
        locale,
        currentPath,
        segments[1],
        resolvedDeps
      );
    }

    return { status: 'not_found' };
  }

  if (section === 'posts') {
    if (isTopLevelSection) {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.POSTS_READ],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildPostsPage(locale, currentPath, input.search, resolvedDeps);
    }

    if (segments.length === 2 && segments[1] === 'add') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.POSTS_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildPostAddPage(locale, currentPath, resolvedDeps);
    }

    if (segments.length === 3 && segments[2] === 'edit') {
      const denied = await requireAdminSectionPermissions(
        user.id,
        [PERMISSIONS.POSTS_WRITE],
        locale,
        resolvedDeps
      );
      if (denied) return denied;
      return buildPostEditPage(locale, currentPath, segments[1], resolvedDeps);
    }

    return { status: 'not_found' };
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
    saveSettingsValues: saveAdminSettingsValues,
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

  const saveResult = await routeDeps.saveSettingsValues(input.values);
  if (!saveResult.ok) return actionErr(saveResult.message);

  return actionOk('Settings updated');
}

export async function resolveAdminAction(
  input: AdminActionInput,
  deps?: AdminActionDeps
): Promise<ActionResult> {
  const routeDeps = deps ?? (await getDefaultAdminRouteDeps());
  const locale = normalizeAdminLocale(input.locale);
  if (!locale) {
    return actionErr('Admin locale not found');
  }

  const request = routeDeps.getCurrentRequest();
  const admin = await routeDeps.readSignedInUser(request);
  if (!admin) {
    return actionErr('Sign in required');
  }
  if (!(await routeDeps.hasAdminAccess(admin.id))) {
    return actionErr('Admin access required');
  }

  try {
    switch (input.action) {
      case 'users.update':
        return await updateAdminUser(input, admin.id, locale, routeDeps);
      case 'users.updateRoles':
        return await updateAdminUserRoles(input, admin.id, locale, routeDeps);
      case 'roles.update':
        return await updateAdminRole(input, admin.id, locale, routeDeps);
      case 'roles.updatePermissions':
        return await updateAdminRolePermissions(
          input,
          admin.id,
          locale,
          routeDeps
        );
      case 'roles.delete':
        return await deleteAdminRole(input, admin.id, locale, routeDeps);
      case 'roles.restore':
        return await restoreAdminRole(input, admin.id, locale, routeDeps);
      case 'categories.create':
        return await createAdminCategory(input, admin.id, locale, routeDeps);
      case 'categories.update':
        return await updateAdminCategory(input, admin.id, locale, routeDeps);
      case 'posts.create':
        return await createAdminPost(input, admin.id, locale, routeDeps);
      case 'posts.update':
        return await updateAdminPost(input, admin.id, locale, routeDeps);
      case 'payments.replay.execute':
        return await executeAdminPaymentReplayAction(
          input,
          admin.id,
          locale,
          routeDeps
        );
      default:
        return actionErr('Unknown admin action');
    }
  } catch (error) {
    return actionErr(
      error instanceof Error ? error.message : 'Admin action failed'
    );
  }
}

async function requireActionPermissions(
  userId: string,
  codes: string[],
  deps: Pick<AdminActionDeps, 'hasAllPermissions'>,
  message: string
) {
  if (!(await deps.hasAllPermissions(userId, codes))) {
    throw new Error(message);
  }
}

function getActionId(input: AdminActionInput) {
  const id = input.id?.trim();
  if (!id) {
    throw new Error('Missing admin action id');
  }
  return id;
}

function valuesToFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value);
  }
  return formData;
}

async function updateAdminUser(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.USERS_WRITE],
    deps,
    'Users write permission required'
  );
  const data = parseFormData(
    valuesToFormData(input.values),
    AdminUserUpdateFormSchema,
    { message: 'name is required' }
  );
  const user = await readAdminUserQuery(id, {
    findUserById: deps.findUserById,
  });
  if (!user) {
    throw new Error('User not found');
  }
  const result = await deps.updateUser(user.id, {
    name: data.name,
    image: data.image ?? '',
  });
  if (!result) {
    throw new Error('update user failed');
  }
  return actionOk('user updated', localizeAdminHref(locale, '/admin/users'));
}

async function updateAdminUserRoles(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.USERS_WRITE, PERMISSIONS.ROLES_WRITE],
    deps,
    'User role permission required'
  );
  const user = await readAdminUserQuery(id, {
    findUserById: deps.findUserById,
  });
  if (!user) {
    throw new Error('User not found');
  }
  const parsed = z
    .object({ roles: jsonStringArraySchema })
    .safeParse(input.values);
  if (!parsed.success) {
    throw new Error('invalid roles');
  }
  await deps.replaceUserRoles(user.id, parsed.data.roles, {
    actorUserId: adminUserId,
    source: 'admin.users.updateUserRolesAction',
  });
  return actionOk('roles updated', localizeAdminHref(locale, '/admin/users'));
}

async function updateAdminRole(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.ROLES_WRITE],
    deps,
    'Roles write permission required'
  );
  const data = parseFormData(
    valuesToFormData(input.values),
    AdminRoleUpdateFormSchema,
    { message: 'title and description are required' }
  );
  const result = await updateRoleMetadataUseCase(
    {
      roleId: id,
      title: data.title,
      description: data.description,
      actorUserId: adminUserId,
      source: 'admin.roles.updateRoleAction',
    },
    deps
  );
  if (!result) {
    throw new Error('update role failed');
  }
  return actionOk('role updated', localizeAdminHref(locale, '/admin/roles'));
}

async function updateAdminRolePermissions(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.ROLES_WRITE],
    deps,
    'Roles write permission required'
  );
  const parsed = z
    .object({ permissions: jsonStringArraySchema })
    .safeParse(input.values);
  if (!parsed.success) {
    throw new Error('permissions are required');
  }
  const result = await replaceRolePermissionsUseCase(
    {
      roleId: id,
      permissionIds: parsed.data.permissions,
      actorUserId: adminUserId,
      source: 'admin.roles.updateRolePermissionsAction',
    },
    deps
  );
  if (!result) {
    throw new Error('Role not found');
  }
  return actionOk(
    'permissions updated',
    localizeAdminHref(locale, '/admin/roles')
  );
}

async function deleteAdminRole(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.ROLES_DELETE],
    deps,
    'Roles delete permission required'
  );
  const role = await deleteRoleUseCase(
    {
      roleId: id,
      actorUserId: adminUserId,
      source: 'admin.roles.deleteRoleAction',
    },
    deps
  );
  if (!role) {
    throw new Error('Role not found');
  }
  return actionOk('role deleted', localizeAdminHref(locale, '/admin/roles'));
}

async function restoreAdminRole(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.ROLES_WRITE],
    deps,
    'Roles write permission required'
  );
  const result = await restoreRoleUseCase(
    {
      roleId: id,
      actorUserId: adminUserId,
      source: 'admin.roles.restoreRoleAction',
    },
    deps
  );
  if (result.status === 'not_found') {
    throw new Error('Role not found');
  }
  if (result.status === 'not_deleted') {
    throw new Error('Role is not deleted');
  }
  if (result.status === 'name_conflict') {
    throw new Error(
      'restore role failed: another active role with the same name may already exist'
    );
  }
  return actionOk(
    'role restored',
    localizeAdminHref(locale, '/admin/roles?includeDeleted=1')
  );
}

async function createAdminCategory(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.CATEGORIES_WRITE],
    deps,
    'Categories write permission required'
  );
  const data = parseFormData(
    valuesToFormData(input.values),
    AdminCategoryFormSchema,
    { message: 'slug and title are required' }
  );
  const newCategory: NewTaxonomy = {
    id: deps.createId(),
    userId: adminUserId,
    parentId: '',
    slug: data.slug.toLowerCase(),
    type: TaxonomyType.CATEGORY,
    title: data.title,
    description: data.description ?? '',
    image: '',
    icon: '',
    status: TaxonomyStatus.PUBLISHED,
  };
  const result = await deps.addTaxonomy(newCategory);
  if (!result) {
    throw new Error('add category failed');
  }
  return actionOk(
    'category added',
    localizeAdminHref(locale, '/admin/categories')
  );
}

async function updateAdminCategory(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.CATEGORIES_WRITE],
    deps,
    'Categories write permission required'
  );
  const data = parseFormData(
    valuesToFormData(input.values),
    AdminCategoryFormSchema,
    { message: 'slug and title are required' }
  );
  const category = await deps.findTaxonomy({ id });
  if (!category || category.userId !== adminUserId) {
    throw new Error('access denied');
  }
  const result = await deps.updateTaxonomy(id, {
    parentId: '',
    slug: data.slug.toLowerCase(),
    title: data.title,
    description: data.description ?? '',
    image: '',
    icon: '',
    status: TaxonomyStatus.PUBLISHED,
  });
  if (!result) {
    throw new Error('update category failed');
  }
  return actionOk(
    'category updated',
    localizeAdminHref(locale, '/admin/categories')
  );
}

async function createAdminPost(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.POSTS_WRITE],
    deps,
    'Posts write permission required'
  );
  const data = parseFormData(
    valuesToFormData(input.values),
    AdminPostFormSchema,
    {
      message: 'slug and title are required',
    }
  );
  const newPost: NewPost = {
    id: deps.createId(),
    userId: adminUserId,
    parentId: '',
    slug: data.slug.toLowerCase(),
    type: PostType.ARTICLE,
    title: data.title,
    description: data.description ?? '',
    image: data.image ?? '',
    content: data.content ?? '',
    categories: data.categories ?? '',
    tags: '',
    authorName: data.authorName ?? '',
    authorImage: data.authorImage ?? '',
    status: PostStatus.PUBLISHED,
  };
  const result = await deps.addPost(newPost);
  if (!result) {
    throw new Error('add post failed');
  }
  return actionOk('post added', localizeAdminHref(locale, '/admin/posts'));
}

async function updateAdminPost(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  const id = getActionId(input);
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.POSTS_WRITE],
    deps,
    'Posts write permission required'
  );
  const data = parseFormData(
    valuesToFormData(input.values),
    AdminPostFormSchema,
    {
      message: 'slug and title are required',
    }
  );
  const post = await deps.findPost({ id });
  if (!post) {
    throw new Error('Post not found');
  }
  const result = await deps.updatePost(id, {
    parentId: '',
    slug: data.slug.toLowerCase(),
    type: PostType.ARTICLE,
    title: data.title,
    description: data.description ?? '',
    image: data.image ?? '',
    content: data.content ?? '',
    categories: data.categories ?? '',
    tags: '',
    authorName: data.authorName ?? '',
    authorImage: data.authorImage ?? '',
    status: PostStatus.PUBLISHED,
  });
  if (!result) {
    throw new Error('update post failed');
  }
  return actionOk('post updated', localizeAdminHref(locale, '/admin/posts'));
}

async function executeAdminPaymentReplayAction(
  input: AdminActionInput,
  adminUserId: string,
  locale: Locale,
  deps: AdminActionDeps
) {
  if (deps.resolvePaymentCapability() === 'none') {
    throw new Error('Payment replay is not available');
  }
  await requireActionPermissions(
    adminUserId,
    [PERMISSIONS.PAYMENTS_WRITE],
    deps,
    'Payments write permission required'
  );
  const parsed = z
    .object({
      inboxIds: jsonStringArraySchema,
      operationKind: z.enum([
        PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY,
        PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION,
      ]),
      note: z.string().optional(),
      returnPath: z.string().optional(),
    })
    .safeParse(input.values);
  if (!parsed.success) {
    throw new Error('invalid replay payload');
  }
  const result = await deps.executePaymentReplay({
    inboxIds: parsed.data.inboxIds,
    operationKind: parsed.data.operationKind,
    note: parsed.data.note,
    returnPath: parsed.data.returnPath
      ? localizeReturnPath(locale, parsed.data.returnPath)
      : undefined,
    actorUserId: adminUserId,
  });
  if (result.status === 'not_found') {
    throw new Error('No webhook inbox records selected');
  }
  return actionOk(
    `replay finished: ${result.summary.processed} processed, ${result.summary.failed} failed, ${result.summary.skipped} skipped`,
    result.redirectUrl
  );
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

function buildFormRouteData(
  locale: string,
  currentPath: string,
  title: string,
  form: AdminSettingsForm,
  backPath: string
): Extract<AdminRouteData, { status: 'ok' }> {
  return {
    status: 'ok',
    locale,
    path: currentPath,
    title,
    nav: buildAdminNav(locale, currentPath),
    page: {
      kind: 'form',
      form,
      backHref: localizeAdminHref(locale, backPath),
    },
  };
}

function buildActionForm(input: {
  fields: AdminSettingsFormField[];
  data?: Record<string, AdminSerializableValue>;
  action: string;
  id?: string;
  submitTitle: string;
  submitVariant?: AdminSettingsButton['variant'];
  submitIcon?: string;
  title?: string;
  description?: string;
}): AdminSettingsForm {
  return {
    title: input.title,
    description: input.description,
    fields: input.fields,
    data: input.data ?? {},
    passby: input.id ? { id: input.id } : undefined,
    submit: {
      action: input.action,
      button: {
        title: input.submitTitle,
        variant: input.submitVariant,
        icon: input.submitIcon,
      },
    },
  };
}

async function buildUserEditPage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<AdminRouteDeps, 'findUserById'>
): Promise<AdminRouteData> {
  const user = await readAdminUserQuery(id, {
    findUserById: deps.findUserById,
  });
  if (!user) {
    return { status: 'not_found' };
  }

  return buildFormRouteData(
    locale,
    currentPath,
    'Edit User',
    buildActionForm({
      action: 'users.update',
      id,
      submitTitle: 'Update user',
      data: toSerializableRecord(user),
      fields: [
        disabledField('email', 'Email'),
        requiredTextField('name', 'Name'),
        { name: 'image', type: 'upload_image', title: 'Avatar' },
      ],
    }),
    '/admin/users'
  );
}

async function buildUserRolesPage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<
    AdminRouteDeps,
    'findUserById' | 'listRoles' | 'listUserRolesDetailed'
  >
): Promise<AdminRouteData> {
  const user = await readAdminUserQuery(id, {
    findUserById: deps.findUserById,
  });
  if (!user) {
    return { status: 'not_found' };
  }
  const { roles, userRoles } = await readAdminUserRoleOptionsUseCase(
    user.id,
    deps
  );

  return buildFormRouteData(
    locale,
    currentPath,
    'Edit User Roles',
    buildActionForm({
      action: 'users.updateRoles',
      id,
      submitTitle: 'Update roles',
      data: {
        ...(toSerializableRecord(user) ?? {}),
        roles: userRoles.map((role) => role.id),
      },
      fields: [
        disabledField('email', 'Email'),
        {
          name: 'roles',
          type: 'checkbox',
          title: 'Roles',
          options: roles.map((role) => ({
            title: role.title ?? role.name,
            description: role.description,
            value: role.id,
          })),
          validation: { required: true },
        },
      ],
    }),
    '/admin/users'
  );
}

async function buildRoleEditPage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<AdminRouteDeps, 'findRoleById'>
): Promise<AdminRouteData> {
  const role = await readAdminRoleQuery(id, deps);
  if (!role) {
    return { status: 'not_found' };
  }

  return buildFormRouteData(
    locale,
    currentPath,
    'Edit Role',
    buildActionForm({
      action: 'roles.update',
      id,
      submitTitle: 'Update role',
      data: toSerializableRecord(role),
      fields: [
        disabledField('name', 'Name'),
        requiredTextField('title', 'Title'),
        requiredTextareaField('description', 'Description'),
      ],
    }),
    '/admin/roles'
  );
}

async function buildRolePermissionsPage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<
    AdminRouteDeps,
    'findRoleById' | 'listPermissions' | 'listRolePermissions'
  >
): Promise<AdminRouteData> {
  const detail = await readAdminRolePermissionsQuery(id, deps);
  if (!detail) {
    return { status: 'not_found' };
  }
  const { role, permissions, rolePermissions } = detail;

  return buildFormRouteData(
    locale,
    currentPath,
    'Edit Role Permissions',
    buildActionForm({
      action: 'roles.updatePermissions',
      id,
      submitTitle: 'Update permissions',
      data: {
        ...(toSerializableRecord(role) ?? {}),
        permissions: rolePermissions.map((permission) => permission.id),
      },
      fields: [
        disabledField('name', 'Name'),
        disabledField('title', 'Title'),
        {
          name: 'permissions',
          type: 'checkbox',
          title: 'Permissions',
          options: permissions.map((permission) => ({
            title: permission.title ?? permission.code,
            description: permission.code,
            value: permission.id,
          })),
          validation: { required: true },
        },
      ],
    }),
    '/admin/roles'
  );
}

async function buildRoleDeletePage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<AdminRouteDeps, 'findRoleById'>
): Promise<AdminRouteData> {
  const role = await readAdminRoleQuery(id, deps);
  if (!role || role.deletedAt) {
    return { status: 'not_found' };
  }

  return buildFormRouteData(
    locale,
    currentPath,
    'Delete Role',
    buildActionForm({
      title: 'Delete Role',
      action: 'roles.delete',
      id,
      submitTitle: 'Delete role',
      submitVariant: 'destructive',
      submitIcon: 'RiDeleteBinLine',
      data: toSerializableRecord(role),
      fields: [
        disabledField('name', 'Name'),
        disabledField('title', 'Title'),
        disabledTextareaField('description', 'Description'),
        disabledField('status', 'Status'),
      ],
    }),
    '/admin/roles'
  );
}

async function buildRoleRestorePage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<AdminRouteDeps, 'findRoleById'>
): Promise<AdminRouteData> {
  const role = await readAdminRoleQuery(id, deps);
  if (!role || !role.deletedAt) {
    return { status: 'not_found' };
  }

  return buildFormRouteData(
    locale,
    currentPath,
    'Restore Role',
    buildActionForm({
      title: 'Restore Role',
      action: 'roles.restore',
      id,
      submitTitle: 'Restore role',
      data: toSerializableRecord(role),
      fields: [
        disabledField('name', 'Name'),
        disabledField('title', 'Title'),
        disabledTextareaField('description', 'Description'),
        disabledField('deletedAt', 'Deleted At'),
      ],
    }),
    '/admin/roles?includeDeleted=1'
  );
}

function buildCategoryAddPage(
  locale: Locale,
  currentPath: string
): AdminRouteData {
  return buildFormRouteData(
    locale,
    currentPath,
    'Add Category',
    buildActionForm({
      action: 'categories.create',
      submitTitle: 'Add category',
      fields: categoryFields(),
    }),
    '/admin/categories'
  );
}

async function buildCategoryEditPage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<AdminRouteDeps, 'findTaxonomy'>
): Promise<AdminRouteData> {
  const category = await deps.findTaxonomy({ id });
  if (!category) {
    return { status: 'not_found' };
  }
  return buildFormRouteData(
    locale,
    currentPath,
    'Edit Category',
    buildActionForm({
      action: 'categories.update',
      id,
      submitTitle: 'Update category',
      data: toSerializableRecord(category),
      fields: categoryFields(),
    }),
    '/admin/categories'
  );
}

async function buildPostAddPage(
  locale: Locale,
  currentPath: string,
  deps: Pick<AdminRouteDeps, 'listCategories'>
): Promise<AdminRouteData> {
  return buildFormRouteData(
    locale,
    currentPath,
    'Add Post',
    buildActionForm({
      action: 'posts.create',
      submitTitle: 'Add post',
      fields: await postFields(deps),
    }),
    '/admin/posts'
  );
}

async function buildPostEditPage(
  locale: Locale,
  currentPath: string,
  id: string,
  deps: Pick<AdminRouteDeps, 'findPost' | 'listCategories'>
): Promise<AdminRouteData> {
  const post = await deps.findPost({ id });
  if (!post) {
    return { status: 'not_found' };
  }
  return buildFormRouteData(
    locale,
    currentPath,
    'Edit Post',
    buildActionForm({
      action: 'posts.update',
      id,
      submitTitle: 'Update post',
      data: toSerializableRecord(post),
      fields: await postFields(deps),
    }),
    '/admin/posts'
  );
}

async function buildPaymentReplayPage(
  locale: Locale,
  currentPath: string,
  search: unknown,
  deps: Pick<AdminRouteDeps, 'listPaymentReplayPreview'>
): Promise<AdminRouteData> {
  const query = parseSearchObject(search);
  const provider = query.provider?.trim() || '';
  const eventId = query.eventId?.trim() || '';
  const status = normalizePaymentReplayStatus(query.status);
  const receivedFrom = query.receivedFrom?.trim() || '';
  const receivedTo = query.receivedTo?.trim() || '';
  const operationKind =
    query.operationKind === PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION
      ? PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION
      : PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY;
  const previewEnabled = query.preview === '1';
  const rows = previewEnabled
    ? await deps.listPaymentReplayPreview({
        provider: provider || undefined,
        eventId: eventId || undefined,
        status,
        receivedFrom: parsePaymentReplayDateTime(receivedFrom),
        receivedTo: parsePaymentReplayDateTime(receivedTo),
      })
    : [];
  const replayRows = rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    label: getPaymentReplayPreviewLabel(row),
    eventId: row.eventId || '',
    eventType: row.eventType || '',
    receivedAt: row.receivedAt.toISOString(),
    attempts: String(row.processingAttemptCount),
    lastError: row.lastError || '',
    executable: Boolean(row.canonicalEvent),
  }));
  const returnPath = localizeAdminHref(
    locale,
    buildPaymentReplayReturnPath({
      preview: '1',
      provider,
      eventId,
      status,
      receivedFrom,
      receivedTo,
      operationKind,
    })
  );

  return {
    status: 'ok',
    locale,
    path: currentPath,
    title: 'Webhook Replay',
    nav: buildAdminNav(locale, currentPath),
    page: {
      kind: 'payment_replay',
      filters: {
        provider,
        eventId,
        status,
        operationKind,
        receivedFrom,
        receivedTo,
      },
      previewEnabled,
      rows: replayRows,
      executableIds: replayRows
        .filter((row) => row.executable)
        .map((row) => row.id),
      returnPath,
      executedMessage:
        query.executed === '1'
          ? `Executed. processed=${query.processed || '0'}, failed=${query.failed || '0'}, skipped=${query.skipped || '0'}`
          : undefined,
      errorMessage:
        query.execute_error === '1'
          ? `Execute failed: ${query.message || 'unknown error'}`
          : undefined,
    },
  };
}

function requiredTextField(
  name: string,
  title: string
): AdminSettingsFormField {
  return { name, type: 'text', title, validation: { required: true } };
}

function requiredTextareaField(
  name: string,
  title: string
): AdminSettingsFormField {
  return { name, type: 'textarea', title, validation: { required: true } };
}

function disabledField(name: string, title: string): AdminSettingsFormField {
  return {
    name,
    type: 'text',
    title,
    validation: { required: true },
    attributes: { disabled: true },
  };
}

function disabledTextareaField(
  name: string,
  title: string
): AdminSettingsFormField {
  return {
    name,
    type: 'textarea',
    title,
    validation: { required: true },
    attributes: { disabled: true },
  };
}

function categoryFields(): AdminSettingsFormField[] {
  return [
    {
      ...requiredTextField('slug', 'Slug'),
      tip: 'unique slug for the category',
    },
    requiredTextField('title', 'Title'),
    { name: 'description', type: 'textarea', title: 'Description' },
  ];
}

async function postFields(
  deps: Pick<AdminRouteDeps, 'listCategories'>
): Promise<AdminSettingsFormField[]> {
  const categories = await deps.listCategories({
    type: TaxonomyType.CATEGORY,
    status: TaxonomyStatus.PUBLISHED,
  });
  return [
    {
      ...requiredTextField('slug', 'Slug'),
      tip: 'unique slug for the post',
    },
    requiredTextField('title', 'Title'),
    { name: 'description', type: 'textarea', title: 'Description' },
    {
      name: 'categories',
      type: 'select',
      title: 'Categories',
      options: categories.map((category) => ({
        title: category.title,
        value: category.id,
      })),
    },
    {
      name: 'image',
      type: 'upload_image',
      title: 'Image',
      metadata: { max: 1 },
    },
    { name: 'authorName', type: 'text', title: 'Author Name' },
    { name: 'authorImage', type: 'upload_image', title: 'Author Image' },
    { name: 'content', type: 'markdown_editor', title: 'Content' },
  ];
}

function normalizePaymentReplayStatus(
  value: string | undefined
): AdminPaymentReplayStatus {
  if (!value || value === 'all') return 'all';
  const statuses = new Set<string>(Object.values(PAYMENT_WEBHOOK_INBOX_STATUS));
  return statuses.has(value) ? (value as AdminPaymentReplayStatus) : 'all';
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
        edit: localizeAdminHref(locale, `/admin/users/${row.id}/edit`),
        roles: localizeAdminHref(locale, `/admin/users/${row.id}/edit-roles`),
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
    actions: [
      {
        title: 'Webhook Replay',
        href: localizeAdminHref(locale, '/admin/payments/replay'),
      },
    ],
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
      { key: 'id', title: 'ID' },
      { key: 'name', title: 'Name' },
      { key: 'title', title: 'Title' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
      { key: 'deletedAt', title: 'Deleted' },
      { key: 'edit', title: 'Edit' },
      { key: 'permissions', title: 'Permissions' },
      { key: 'delete', title: 'Delete' },
      { key: 'restore', title: 'Restore' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      const id = toAdminCell(record.id);
      return {
        id,
        name: toAdminCell(record.name),
        title: toAdminCell(record.title),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
        deletedAt: toAdminCell(record.deletedAt),
        edit: localizeAdminHref(locale, `/admin/roles/${id}/edit`),
        permissions: localizeAdminHref(
          locale,
          `/admin/roles/${id}/edit-permissions`
        ),
        delete: record.deletedAt
          ? ''
          : localizeAdminHref(locale, `/admin/roles/${id}/delete`),
        restore: record.deletedAt
          ? localizeAdminHref(locale, `/admin/roles/${id}/restore`)
          : '',
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
    actions: [
      {
        title: 'Add Category',
        href: localizeAdminHref(locale, '/admin/categories/add'),
      },
    ],
    columns: [
      { key: 'id', title: 'ID' },
      { key: 'slug', title: 'Slug' },
      { key: 'title', title: 'Title' },
      { key: 'status', title: 'Status' },
      { key: 'createdAt', title: 'Created' },
      { key: 'updatedAt', title: 'Updated' },
      { key: 'edit', title: 'Edit' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      const id = toAdminCell(record.id);
      return {
        id,
        slug: toAdminCell(record.slug),
        title: toAdminCell(record.title),
        status: toAdminCell(record.status),
        createdAt: toAdminCell(record.createdAt),
        updatedAt: toAdminCell(record.updatedAt),
        edit: localizeAdminHref(locale, `/admin/categories/${id}/edit`),
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
    actions: [
      {
        title: 'Add Post',
        href: localizeAdminHref(locale, '/admin/posts/add'),
      },
    ],
    columns: [
      { key: 'id', title: 'ID' },
      { key: 'title', title: 'Title' },
      { key: 'authorName', title: 'Author' },
      { key: 'image', title: 'Image' },
      { key: 'categories', title: 'Categories' },
      { key: 'createdAt', title: 'Created' },
      { key: 'edit', title: 'Edit' },
    ],
    rows: rows.map((row) => {
      const record = asRecord(row);
      const id = toAdminCell(record.id);
      return {
        id,
        title: toAdminCell(record.title),
        authorName: toAdminCell(record.authorName),
        image: toAdminCell(record.image),
        categories: toAdminCell(record.categories),
        createdAt: toAdminCell(record.createdAt),
        edit: localizeAdminHref(locale, `/admin/posts/${id}/edit`),
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
