'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from '@/infra/platform/i18n/navigation';
import { siteI18nManifest } from '@/site';
import { Check, Globe, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import {
  defaultLocale,
  localeNames,
  locales,
  type Locale,
} from '@/config/locale';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

type SiteI18nManifestLocales = Record<
  string,
  Record<string, { path: string; status: string }>
>;

function stripTrailingSlash(pathname: string) {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

export function normalizeLocaleSwitcherPath(
  pathname: string,
  currentLocale: string
) {
  const normalizedPathname = stripTrailingSlash(pathname || '/');
  const segments = normalizedPathname.split('/').filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && locales.includes(firstSegment as Locale)) {
    const withoutLocale = segments.slice(1).join('/');
    return withoutLocale ? `/${withoutLocale}` : '/';
  }

  if (
    currentLocale !== defaultLocale &&
    normalizedPathname.startsWith(`/${currentLocale}/`)
  ) {
    const withoutLocale = normalizedPathname.slice(currentLocale.length + 1);
    return withoutLocale || '/';
  }

  return normalizedPathname;
}

export function getApprovedLocalesForSwitcher(pathname: string): Locale[] {
  const approvedLocales: Locale[] = [defaultLocale];
  const manifestLocales = siteI18nManifest.locales as SiteI18nManifestLocales;

  for (const locale of locales) {
    if (locale === defaultLocale) {
      continue;
    }

    const entries = manifestLocales[locale] ?? {};
    const hasApprovedPage = Object.values(entries).some(
      (entry) => entry.path === pathname && entry.status === 'approved'
    );

    if (hasApprovedPage) {
      approvedLocales.push(locale);
    }
  }

  return approvedLocales;
}

export function LocaleSelector({
  type = 'icon',
}: {
  type?: 'icon' | 'button';
}) {
  const currentLocale = useLocale();
  const t = useTranslations('common.locale_switcher');
  const router = useRouter();
  const pathname = usePathname();
  const availableLocales = useMemo(() => {
    const normalizedPath = normalizeLocaleSwitcherPath(pathname, currentLocale);
    const approvedLocales = getApprovedLocalesForSwitcher(normalizedPath);

    if (approvedLocales.includes(currentLocale as Locale)) {
      return approvedLocales;
    }

    return [
      currentLocale as Locale,
      ...approvedLocales.filter((locale) => locale !== currentLocale),
    ];
  }, [currentLocale, pathname]);

  const handleSwitchLanguage = (value: string) => {
    if (
      !availableLocales.includes(value as Locale) ||
      value === currentLocale
    ) {
      return;
    }

    const search = typeof window === 'undefined' ? '' : window.location.search;
    router.push(`${pathname}${search}`, {
      locale: value,
    });
  };

  if (availableLocales.length <= 1) {
    return null;
  }

  const currentLocaleName =
    localeNames[currentLocale as Locale] ?? currentLocale;

  const getLocaleName = (locale: Locale) => {
    return localeNames[locale] ?? locale;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {type === 'icon' ? (
          <Button
            aria-label={t('aria_label')}
            type="button"
            variant="ghost"
            size="icon"
            className="h-auto w-auto p-0"
          >
            <Languages size={18} />
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="hover:bg-primary/10"
          >
            <Globe size={16} />
            {currentLocaleName}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {availableLocales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleSwitchLanguage(locale)}
          >
            <span>{getLocaleName(locale)}</span>
            {locale === (currentLocale as Locale) && (
              <Check size={16} className="text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
