import Link from 'next/link';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { filterLandingNavItems } from '@/surfaces/public/navigation/landing-visibility';

import { defaultLocale } from '@/config/locale';
import { AppImage } from '@/shared/blocks/common/app-image';
import { LocaleSelector } from '@/shared/blocks/common/locale-selector';
import { cn } from '@/shared/lib/utils';
import type { NavItem } from '@/shared/types/blocks/common';
import type { Footer as FooterType } from '@/shared/types/blocks/landing';

function withLocale(href: string, locale: string) {
  if (!href) return href;
  if (href.startsWith('http')) return href;
  if (!href.startsWith('/')) return href;
  if (!locale || locale === defaultLocale) return href;
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function MarketingFooter({
  footer,
  locale,
  publicConfig,
}: {
  footer: FooterType;
  locale: string;
  publicConfig?: PublicUiConfig;
}) {
  const navItems = filterLandingNavItems(footer.nav?.items, publicConfig);
  let navGridCols = 'sm:grid-cols-1';
  if (navItems.length >= 3) {
    navGridCols = 'sm:grid-cols-3';
  } else if (navItems.length === 2) {
    navGridCols = 'sm:grid-cols-2';
  }

  return (
    <footer
      id={footer.id}
      className={`overflow-x-hidden py-12 ${footer.className || ''}`}
    >
      <div className="container space-y-10 overflow-x-hidden">
        <div className="grid min-w-0 gap-10 md:grid-cols-5">
          <div className="min-w-0 space-y-4 break-words md:col-span-2">
            {footer.brand?.url ? (
              <Link
                href={withLocale(footer.brand.url, locale)}
                target={footer.brand.target || '_self'}
                prefetch={false}
                className={`flex items-center gap-2 ${footer.brand.className || ''}`}
              >
                {footer.brand.logo ? (
                  <AppImage
                    src={footer.brand.logo.src}
                    alt={footer.brand.logo.alt || ''}
                    width={40}
                    height={40}
                    className="h-10 w-10"
                  />
                ) : null}
                {footer.brand.title ? (
                  <span className="text-base font-medium">
                    {footer.brand.title}
                  </span>
                ) : null}
              </Link>
            ) : null}

            {footer.brand?.description ? (
              <p
                className="text-muted-foreground text-sm text-balance"
                dangerouslySetInnerHTML={{ __html: footer.brand.description }}
              />
            ) : null}
          </div>

          <div className={cn('col-span-3 grid min-w-0 gap-6', navGridCols)}>
            {navItems.map((item, idx) => (
              <div key={idx} className="min-w-0 space-y-4 text-sm break-words">
                <span className="block font-medium break-words">
                  {item.title}
                </span>
                <div className="flex min-w-0 flex-wrap gap-4 sm:flex-col">
                  {item.children?.map((subItem: NavItem, iidx: number) => (
                    <Link
                      key={iidx}
                      href={withLocale(subItem.url || '', locale)}
                      target={subItem.target || '_self'}
                      prefetch={false}
                      className="text-muted-foreground hover:text-primary block min-h-11 py-2 break-words duration-150"
                    >
                      {subItem.title || ''}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden
          className="h-px min-w-0 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)] bg-[length:6px_1px] bg-repeat-x opacity-25"
        />

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-6">
          {footer.copyright ? (
            <p
              className="text-muted-foreground text-sm text-balance break-words"
              dangerouslySetInnerHTML={{ __html: footer.copyright }}
            />
          ) : null}

          {footer.agreement?.items?.length ? (
            <div className="flex min-w-0 flex-wrap items-center gap-4">
              {footer.agreement.items.map((item: NavItem, idx: number) => (
                <Link
                  key={idx}
                  href={withLocale(item.url || '', locale)}
                  target={item.target || '_self'}
                  prefetch={false}
                  className="text-muted-foreground hover:text-primary block min-h-11 py-2 text-xs break-words underline duration-150"
                >
                  {item.title || ''}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="min-w-0">
            <LocaleSelector type="button" />
          </div>
        </div>
      </div>
    </footer>
  );
}
