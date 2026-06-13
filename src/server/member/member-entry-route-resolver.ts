import { isAiEnabled } from '@/domains/ai/domain/enablement';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { readPublicUiConfigFresh } from '@/domains/settings/application/settings-runtime.query';
import type {
  MemberEntryKind,
  MemberEntryRouteData,
} from '@/surfaces/member/member-entry/member-entry.types';

import { localePath, normalizeLocale } from '@/shared/i18n/locale';

type MemberEntryInput = {
  locale: unknown;
  kind: MemberEntryKind;
  search?: unknown;
};

type MemberEntryResolverDeps = {
  readPublicUiConfig?: () => Promise<PublicUiConfig>;
};

const leafPathByKind: Record<MemberEntryKind, string> = {
  settings: '/settings/profile',
  activity: '/activity/ai-tasks',
};

export async function resolveMemberEntryRouteData(
  input: MemberEntryInput,
  deps: MemberEntryResolverDeps = {}
): Promise<MemberEntryRouteData | null> {
  const locale = normalizeLocale(
    typeof input.locale === 'string' ? input.locale : null
  );
  if (!locale) {
    return null;
  }

  if (input.kind === 'activity') {
    const publicUiConfig = await (
      deps.readPublicUiConfig ?? readPublicUiConfigFresh
    )();
    if (!isAiEnabled(publicUiConfig)) {
      return null;
    }
  }

  return {
    locale,
    kind: input.kind,
    redirectTo: buildMemberEntryRedirectTo(
      leafPathByKind[input.kind],
      locale,
      input.search
    ),
  };
}

function buildMemberEntryRedirectTo(
  path: string,
  locale: string,
  search: unknown
) {
  const localizedPath = localePath(path, locale);
  const query = buildSearchQuery(search);

  return query ? `${localizedPath}?${query}` : localizedPath;
}

function buildSearchQuery(search: unknown) {
  if (!search) {
    return '';
  }

  if (typeof search === 'string') {
    return search.startsWith('?') ? search.slice(1) : search;
  }

  if (search instanceof URLSearchParams) {
    return search.toString();
  }

  if (typeof search !== 'object') {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(
    search as Record<string, unknown>
  )) {
    appendSearchValue(params, key, value);
  }

  return params.toString();
}

function appendSearchValue(
  params: URLSearchParams,
  key: string,
  value: unknown
) {
  if (value === undefined || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendSearchValue(params, key, item);
    }
    return;
  }

  params.append(key, String(value));
}
