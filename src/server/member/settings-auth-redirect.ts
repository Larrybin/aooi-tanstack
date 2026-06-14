import { redirect } from '@tanstack/react-router';

import { localePath } from '@/shared/i18n/locale';
import { withCallbackUrl } from '@/shared/lib/callback-url';

type SettingsRouteDataWithViewer = {
  viewer: {
    signedIn: boolean;
  };
};

export function buildSettingsSignInRedirectHref({
  locale,
  pathname,
  search,
}: {
  locale: string;
  pathname: unknown;
  search?: unknown;
}) {
  return withCallbackUrl(
    localePath('/sign-in', locale),
    `${normalizePathname(pathname)}${normalizeSearch(search)}`
  );
}

export function redirectUnsignedSettingsVisitor({
  data,
  locale,
  pathname,
  search,
}: {
  data: SettingsRouteDataWithViewer;
  locale: string;
  pathname: unknown;
  search?: unknown;
}): void {
  if (data.viewer.signedIn) {
    return;
  }

  throw redirect({
    href: buildSettingsSignInRedirectHref({ locale, pathname, search }),
  });
}

function normalizePathname(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') ? value : '/';
}

function normalizeSearch(value: unknown) {
  if (typeof value === 'string') {
    if (!value) return '';
    return value.startsWith('?') ? value : `?${value}`;
  }

  if (value instanceof URLSearchParams) {
    return value.size > 0 ? `?${value.toString()}` : '';
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(value)) {
    appendSearchParam(params, key, raw);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function appendSearchParam(
  params: URLSearchParams,
  key: string,
  value: unknown
) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      appendSearchParam(params, key, item);
    }
    return;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    params.append(key, String(value));
  }
}
