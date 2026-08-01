import { useEffect, type ReactNode } from 'react';

import { isRtlLocale } from '@/config/locale';

import { LandingShellView } from '../shell/landing-shell.view';
import type { HomeRouteBaseData } from './home.contracts';

export function HomeLayoutView({
  data,
  skipLink,
  children,
}: {
  data: HomeRouteBaseData;
  skipLink?: { href: string; label: string } | null;
  children: ReactNode;
}) {
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <>
      {skipLink ? (
        <a
          href={skipLink.href}
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-[#173D29] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:ring-2 focus:ring-[#7ED69F] focus:ring-offset-2 focus:outline-none"
        >
          {skipLink.label}
        </a>
      ) : null}
      <LandingShellView shell={data.shell}>{children}</LandingShellView>
    </>
  );
}
