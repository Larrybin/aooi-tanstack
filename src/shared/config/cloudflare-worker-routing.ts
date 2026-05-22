import { locales } from '../../config/locale/index';
import {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  getServerWorkerMetadata,
  type CloudflareServerWorkerTarget,
  type CloudflareSplitWorkerTarget,
} from './cloudflare-worker-topology';

const localeSet: ReadonlySet<string> = new Set(locales);

type WorkerRouteDefinition = ReturnType<typeof getServerWorkerMetadata> & {
  readonly routeTemplates: readonly string[];
  readonly patterns: readonly string[];
  readonly pathnamePrefixes?: readonly string[];
  readonly exactPathnames?: readonly string[];
};

export type WorkerRoutingDecision =
  | {
      readonly kind: 'active';
      readonly target: CloudflareServerWorkerTarget;
    }
  | {
      readonly kind: 'disabled-api';
      readonly target: 'public-web';
      readonly disabledTarget: CloudflareSplitWorkerTarget;
    }
  | {
      readonly kind: 'disabled-page';
      readonly target: 'public-web';
      readonly disabledTarget: CloudflareSplitWorkerTarget;
    };

const SPLIT_WORKERS: Record<
  CloudflareSplitWorkerTarget,
  WorkerRouteDefinition
> = {
  auth: {
    ...getServerWorkerMetadata('auth'),
    routeTemplates: ['app/api/auth/[...all]/route'],
    patterns: ['/api/auth', '/api/auth/*'],
    pathnamePrefixes: ['/api/auth'],
  },
  payment: {
    ...getServerWorkerMetadata('payment'),
    routeTemplates: [
      'app/api/payment/callback/route',
      'app/api/payment/checkout/route',
      'app/api/payment/notify/route',
      'app/[locale]/(landing)/settings/billing/retrieve/page',
      'app/[locale]/(landing)/settings/invoices/retrieve/page',
    ],
    patterns: [
      '/api/payment',
      '/api/payment/*',
      '/settings/billing/retrieve',
      '/*/settings/billing/retrieve',
      '/settings/invoices/retrieve',
      '/*/settings/invoices/retrieve',
    ],
    pathnamePrefixes: ['/api/payment'],
    exactPathnames: [
      '/settings/billing/retrieve',
      '/settings/invoices/retrieve',
    ],
  },
  member: {
    ...getServerWorkerMetadata('member'),
    routeTemplates: [
      'app/[locale]/(landing)/activity/page',
      'app/[locale]/(landing)/activity/ai-tasks/page',
      'app/[locale]/(landing)/activity/ai-tasks/[id]/refresh/page',
      'app/[locale]/(landing)/activity/chats/page',
      'app/[locale]/(landing)/activity/feedbacks/page',
      'app/[locale]/(landing)/settings/page',
      'app/[locale]/(landing)/settings/apikeys/page',
      'app/[locale]/(landing)/settings/apikeys/[id]/edit/page',
      'app/[locale]/(landing)/settings/apikeys/[id]/delete/page',
      'app/[locale]/(landing)/settings/apikeys/create/page',
      'app/[locale]/(landing)/settings/payments/page',
      'app/[locale]/(landing)/settings/security/page',
      'app/[locale]/(landing)/settings/profile/page',
      'app/[locale]/(landing)/settings/credits/page',
      'app/[locale]/(landing)/settings/billing/page',
      'app/[locale]/(landing)/settings/billing/cancel/page',
      'app/api/user/self-details/route',
      'app/api/user/get-user-credits/route',
    ],
    patterns: [
      '/activity',
      '/activity/*',
      '/*/activity',
      '/*/activity/*',
      '/settings',
      '/settings/*',
      '/*/settings',
      '/*/settings/*',
      '/api/user/self-details',
      '/api/user/get-user-credits',
    ],
    pathnamePrefixes: ['/activity', '/settings'],
    exactPathnames: ['/api/user/self-details', '/api/user/get-user-credits'],
  },
  chat: {
    ...getServerWorkerMetadata('chat'),
    routeTemplates: [
      'app/[locale]/(chat)/chat/page',
      'app/[locale]/(chat)/chat/history/page',
      'app/[locale]/(chat)/chat/[id]/page',
      'app/api/chat/route',
      'app/api/chat/info/route',
      'app/api/chat/list/route',
      'app/api/chat/messages/route',
      'app/api/chat/new/route',
    ],
    patterns: [
      '/chat',
      '/chat/*',
      '/*/chat',
      '/*/chat/*',
      '/api/chat',
      '/api/chat/*',
    ],
    pathnamePrefixes: ['/chat', '/api/chat'],
  },
  admin: {
    ...getServerWorkerMetadata('admin'),
    routeTemplates: [
      'app/[locale]/(admin)/admin/page',
      'app/[locale]/(admin)/admin/credits/page',
      'app/[locale]/(admin)/admin/posts/page',
      'app/[locale]/(admin)/admin/permissions/page',
      'app/[locale]/(admin)/admin/chats/page',
      'app/[locale]/(admin)/admin/categories/page',
      'app/[locale]/(admin)/admin/posts/[id]/edit/page',
      'app/[locale]/(admin)/admin/posts/add/page',
      'app/[locale]/(admin)/admin/roles/page',
      'app/[locale]/(admin)/admin/apikeys/page',
      'app/[locale]/(admin)/admin/users/page',
      'app/[locale]/(admin)/admin/payments/page',
      'app/[locale]/(admin)/admin/categories/add/page',
      'app/[locale]/(admin)/admin/subscriptions/page',
      'app/[locale]/(admin)/admin/ai-tasks/page',
      'app/[locale]/admin/no-permission/page',
      'app/[locale]/(admin)/admin/roles/[id]/delete/page',
      'app/[locale]/(admin)/admin/settings/[tab]/page',
      'app/[locale]/(admin)/admin/roles/[id]/restore/page',
      'app/[locale]/(admin)/admin/roles/[id]/edit-permissions/page',
      'app/[locale]/(admin)/admin/categories/[id]/edit/page',
      'app/[locale]/(admin)/admin/roles/[id]/edit/page',
      'app/[locale]/(admin)/admin/users/[id]/edit-roles/page',
      'app/[locale]/(admin)/admin/users/[id]/edit/page',
    ],
    patterns: ['/admin', '/admin/*', '/*/admin', '/*/admin/*'],
    pathnamePrefixes: ['/admin'],
  },
};

export function stripLocalePrefix(pathname: string) {
  const normalized = normalizePathname(pathname);
  const [, firstSegment = ''] = normalized.split('/');
  if (!localeSet.has(firstSegment)) {
    return normalized;
  }

  const withoutLocale = normalized.slice(firstSegment.length + 1);
  return normalizePathname(withoutLocale || '/');
}

export function resolveWorkerRoutingDecision(
  pathname: string,
  activeTargets: readonly CloudflareServerWorkerTarget[] = CLOUDFLARE_ALL_SERVER_WORKER_TARGETS
): WorkerRoutingDecision {
  const strippedPathname = stripLocalePrefix(pathname);
  const activeTargetSet = new Set(activeTargets);

  for (const [target, split] of Object.entries(SPLIT_WORKERS) as Array<
    [CloudflareSplitWorkerTarget, WorkerRouteDefinition]
  >) {
    if (matchesSplitPathname(split, strippedPathname)) {
      if (activeTargetSet.has(target)) {
        return {
          kind: 'active',
          target,
        };
      }

      return {
        kind: strippedPathname.startsWith('/api/')
          ? 'disabled-api'
          : 'disabled-page',
        target: 'public-web',
        disabledTarget: target,
      };
    }
  }

  return {
    kind: 'active',
    target: 'public-web',
  };
}

export function resolveWorkerTarget(
  pathname: string,
  activeTargets: readonly CloudflareServerWorkerTarget[] = CLOUDFLARE_ALL_SERVER_WORKER_TARGETS
): CloudflareServerWorkerTarget {
  return resolveWorkerRoutingDecision(pathname, activeTargets).target;
}

export function getSplitWorker(target: CloudflareSplitWorkerTarget) {
  return SPLIT_WORKERS[target];
}

export function getAllSplitWorkers() {
  return SPLIT_WORKERS;
}

function matchesSplitPathname(
  split: Pick<WorkerRouteDefinition, 'pathnamePrefixes' | 'exactPathnames'>,
  pathname: string
) {
  const exactPathnames = split.exactPathnames || [];
  if (exactPathnames.includes(pathname)) {
    return true;
  }

  const pathnamePrefixes = split.pathnamePrefixes || [];
  return pathnamePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/';
  }

  const url = new URL(pathname, 'https://router.internal');
  const normalizedPath = url.pathname.replace(/\/+$/, '') || '/';
  return normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
}
