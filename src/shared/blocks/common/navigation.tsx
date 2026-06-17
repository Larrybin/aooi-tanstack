import { useCallback, useMemo, type AnchorHTMLAttributes } from 'react';
import { useLocation } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';
import { getLocaleFromPathname, localePath } from '@/shared/i18n/locale';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
};

const PROTOCOL_OR_HASH_HREF = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

function getPathnameFromHref(href: string) {
  return href.split(/[?#]/, 1)[0] || '/';
}

function isNonPageHref(href: string) {
  if (!href.startsWith('/') || PROTOCOL_OR_HASH_HREF.test(href)) {
    return true;
  }

  const pathname = getPathnameFromHref(href);
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return true;
  }
  if (pathname.startsWith('/_')) {
    return true;
  }

  return (pathname.split('/').filter(Boolean).at(-1) ?? '').includes('.');
}

export function localizeNavigationHref(href: string, currentPathname: string) {
  const locale = getLocaleFromPathname(currentPathname);
  if (!locale || locale === defaultLocale || isNonPageHref(href)) {
    return href;
  }
  if (getLocaleFromPathname(getPathnameFromHref(href))) {
    return href;
  }

  return localePath(href, locale);
}

export function Link({ href, ...props }: LinkProps) {
  const pathname = useLocation({ select: (location) => location.pathname });

  return <a href={localizeNavigationHref(href, pathname)} {...props} />;
}

export function usePathname() {
  return useLocation({ select: (location) => location.pathname });
}

export function useRouter() {
  const push = useCallback((href: string) => {
    window.location.assign(href);
  }, []);
  const replace = useCallback((href: string) => {
    window.location.replace(href);
  }, []);
  const refresh = useCallback(() => {
    window.location.reload();
  }, []);

  return useMemo(() => ({ push, replace, refresh }), [push, refresh, replace]);
}
