import { localeMessagesPaths, type Locale } from '@/config/locale';

import { routing } from './config';

export function normalizeLocale(
  input: string | null | undefined
): Locale | undefined {
  if (!input) return undefined;

  const normalized = input === 'zh-CN' ? 'zh' : input;

  return routing.locales.includes(normalized as Locale)
    ? (normalized as Locale)
    : undefined;
}

export function normalizeAppPathname(pathname: string): string {
  if (!pathname) return '/';

  const [pathWithoutHash] = pathname.split('#');
  const [pathWithoutQuery] = pathWithoutHash.split('?');
  const withLeadingSlash = pathWithoutQuery.startsWith('/')
    ? pathWithoutQuery
    : `/${pathWithoutQuery}`;
  const segments = withLeadingSlash.split('/').filter(Boolean);

  if (!segments.length) {
    return '/';
  }

  const [firstSegment, ...restSegments] = segments;
  const normalizedSegments = routing.locales.includes(firstSegment as Locale)
    ? restSegments
    : segments;
  const normalizedPath = `/${normalizedSegments.join('/')}`;

  if (normalizedPath === '/') {
    return normalizedPath;
  }

  return normalizedPath.replace(/\/+$/, '') || '/';
}

const sortedMessagePaths = [...localeMessagesPaths].sort(
  (left, right) => right.length - left.length
);

export function resolveMessagePath(namespace: string): string {
  const normalizedNamespace = namespace.replace(/\./g, '/');
  const matchedPath = sortedMessagePaths.find(
    (messagePath) =>
      normalizedNamespace === messagePath ||
      normalizedNamespace.startsWith(`${messagePath}/`)
  );

  if (matchedPath) {
    return matchedPath;
  }

  const [topLevelPath] = normalizedNamespace.split('/');
  if (localeMessagesPaths.includes(topLevelPath)) {
    return topLevelPath;
  }

  throw new Error(`[i18n] Unknown namespace "${namespace}"`);
}

function pushNamespace(target: string[], namespace: string) {
  if (!target.includes(namespace)) {
    target.push(namespace);
  }
}

function appendNamespaces(target: string[], namespaces: readonly string[]) {
  for (const namespace of namespaces) {
    pushNamespace(target, namespace);
  }
}

type PrefixNamespaceRule = {
  prefix: string;
  namespace: string;
};

function applyPrefixNamespaceRules({
  pathname,
  target,
  rules,
  stopAfterFirstMatch,
}: {
  pathname: string;
  target: string[];
  rules: readonly PrefixNamespaceRule[];
  stopAfterFirstMatch: boolean;
}) {
  for (const rule of rules) {
    if (!pathname.startsWith(rule.prefix)) {
      continue;
    }

    pushNamespace(target, rule.namespace);
    if (stopAfterFirstMatch) {
      break;
    }
  }
}

const AUTH_PATHS = new Set([
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
]);

const ADMIN_NAMESPACE_RULES = [
  { prefix: '/admin/ai-tasks', namespace: 'admin.ai-tasks' },
  { prefix: '/admin/apikeys', namespace: 'admin.apikeys' },
  { prefix: '/admin/categories', namespace: 'admin.categories' },
  { prefix: '/admin/chats', namespace: 'admin.chats' },
  { prefix: '/admin/credits', namespace: 'admin.credits' },
  { prefix: '/admin/payments', namespace: 'admin.payments' },
  { prefix: '/admin/permissions', namespace: 'admin.permissions' },
  { prefix: '/admin/posts', namespace: 'admin.posts' },
  { prefix: '/admin/roles', namespace: 'admin.roles' },
  { prefix: '/admin/settings', namespace: 'admin.settings' },
  { prefix: '/admin/subscriptions', namespace: 'admin.subscriptions' },
  { prefix: '/admin/users', namespace: 'admin.users' },
] as const satisfies readonly PrefixNamespaceRule[];

const SETTINGS_NAMESPACE_RULES = [
  { prefix: '/settings/apikeys', namespace: 'settings.apikeys' },
  { prefix: '/settings/billing', namespace: 'settings.billing' },
  { prefix: '/settings/credits', namespace: 'settings.credits' },
  { prefix: '/settings/payments', namespace: 'settings.payments' },
  { prefix: '/settings/profile', namespace: 'settings.profile' },
  { prefix: '/settings/security', namespace: 'settings.security' },
] as const satisfies readonly PrefixNamespaceRule[];

const ACTIVITY_NAMESPACE_RULES = [
  { prefix: '/activity/ai-tasks', namespace: 'activity.ai-tasks' },
  { prefix: '/activity/chats', namespace: 'activity.chats' },
] as const satisfies readonly PrefixNamespaceRule[];

type TerminalNamespaceRule = {
  match: 'exact' | 'prefix';
  path: string;
  namespaces: readonly string[];
};

const TERMINAL_NAMESPACE_RULES = [
  { match: 'exact', path: '/pricing', namespaces: ['landing', 'pricing'] },
  { match: 'exact', path: '/blog', namespaces: ['landing', 'blog'] },
  { match: 'prefix', path: '/blog/', namespaces: ['landing', 'blog'] },
  {
    match: 'exact',
    path: '/ai-image-generator',
    namespaces: ['landing', 'ai.image'],
  },
  {
    match: 'exact',
    path: '/ai-music-generator',
    namespaces: ['landing', 'ai.music'],
  },
  { match: 'exact', path: '/ai-chatbot', namespaces: ['demo.ai-chatbot'] },
  {
    match: 'exact',
    path: '/ai-video-generator',
    namespaces: ['demo.ai-video-generator'],
  },
  {
    match: 'exact',
    path: '/ai-audio-generator',
    namespaces: ['demo.ai-audio-generator'],
  },
  { match: 'exact', path: '/docs', namespaces: [] },
  { match: 'prefix', path: '/docs/', namespaces: [] },
  { match: 'exact', path: '/no-permission', namespaces: [] },
] as const satisfies readonly TerminalNamespaceRule[];

function resolveAdminNamespaces(pathname: string, base: string[]): string[] {
  const namespaces = [...base];
  pushNamespace(namespaces, 'admin.sidebar');

  applyPrefixNamespaceRules({
    pathname,
    target: namespaces,
    rules: ADMIN_NAMESPACE_RULES,
    stopAfterFirstMatch: false,
  });

  return namespaces;
}

function resolveSettingsNamespaces(pathname: string, base: string[]): string[] {
  const namespaces = [...base];
  appendNamespaces(namespaces, ['landing', 'settings.sidebar']);

  applyPrefixNamespaceRules({
    pathname,
    target: namespaces,
    rules: SETTINGS_NAMESPACE_RULES,
    stopAfterFirstMatch: true,
  });

  return namespaces;
}

function resolveActivityNamespaces(pathname: string, base: string[]): string[] {
  const namespaces = [...base];
  appendNamespaces(namespaces, ['landing', 'activity.sidebar']);

  applyPrefixNamespaceRules({
    pathname,
    target: namespaces,
    rules: ACTIVITY_NAMESPACE_RULES,
    stopAfterFirstMatch: true,
  });

  return namespaces;
}

type PrefixNamespaceResolver = {
  prefix: string;
  resolve: (pathname: string, base: string[]) => string[];
};

const PREFIX_NAMESPACE_RESOLVERS = [
  { prefix: '/admin', resolve: resolveAdminNamespaces },
  {
    prefix: '/chat',
    resolve: (_pathname: string, base: string[]) => {
      const namespaces = [...base];
      pushNamespace(namespaces, 'ai.chat');
      return namespaces;
    },
  },
  { prefix: '/settings', resolve: resolveSettingsNamespaces },
  { prefix: '/activity', resolve: resolveActivityNamespaces },
] as const satisfies readonly PrefixNamespaceResolver[];

function resolveTerminalNamespaces(pathname: string): {
  matched: boolean;
  namespaces: readonly string[];
} {
  for (const rule of TERMINAL_NAMESPACE_RULES) {
    const isMatched =
      rule.match === 'exact'
        ? pathname === rule.path
        : pathname.startsWith(rule.path);

    if (isMatched) {
      return { matched: true, namespaces: rule.namespaces };
    }
  }

  return { matched: false, namespaces: [] };
}

export function getRequestNamespaces(pathname: string): string[] {
  const normalizedPathname = normalizeAppPathname(pathname);

  const namespaces: string[] = [];

  if (!normalizedPathname.startsWith('/api/')) {
    pushNamespace(namespaces, 'common.metadata');
  }

  if (normalizedPathname.startsWith('/api/')) {
    return namespaces;
  }

  if (normalizedPathname === '/') {
    pushNamespace(namespaces, 'landing');
    return namespaces;
  }

  if (AUTH_PATHS.has(normalizedPathname)) {
    pushNamespace(namespaces, 'common');
    return namespaces;
  }

  for (const resolver of PREFIX_NAMESPACE_RESOLVERS) {
    if (normalizedPathname.startsWith(resolver.prefix)) {
      return resolver.resolve(normalizedPathname, namespaces);
    }
  }

  const terminal = resolveTerminalNamespaces(normalizedPathname);
  if (terminal.matched) {
    appendNamespaces(namespaces, terminal.namespaces);
    return namespaces;
  }

  pushNamespace(namespaces, 'landing');

  return namespaces;
}
