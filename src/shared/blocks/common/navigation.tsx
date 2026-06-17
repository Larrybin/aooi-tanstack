import { useCallback, useMemo, type AnchorHTMLAttributes } from 'react';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
};

export function Link({ href, ...props }: LinkProps) {
  return <a href={href} {...props} />;
}

export function usePathname() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname;
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
