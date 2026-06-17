'use client';

import { Link } from '@/shared/blocks/common/navigation';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Separator } from '@/shared/components/ui/separator';
import { useSidebar } from '@/shared/components/ui/sidebar';
import type { NavItem } from '@/shared/types/blocks/common';
import type { SidebarFooter as SidebarFooterType } from '@/shared/types/blocks/workspace';

import { GeneralSocialLinks, LocaleSelector } from '../common';

export function SidebarFooter({ footer }: { footer: SidebarFooterType }) {
  const { open } = useSidebar();
  const showLocale = Boolean(footer.show_locale);

  return (
    <>
      {open ? (
        <div className="mx-auto flex w-full items-center justify-start gap-x-4 border-t px-4 py-3">
          {footer.nav?.items
            ?.filter((item) => Boolean(item.url))
            .map((item: NavItem, idx: number) => (
              <div className="hover:text-primary cursor-pointer" key={idx}>
                <Link href={item.url || ''} target={item.target || '_self'}>
                  {item.icon && (
                    <SmartIcon
                      name={item.icon as string}
                      className="text-md"
                      size={20}
                    />
                  )}
                </Link>
              </div>
            ))}

          <GeneralSocialLinks
            className="flex items-center gap-x-4"
            itemClassName="hover:text-primary cursor-pointer"
            iconClassName="text-md"
            iconSize={20}
          />

          <div className="flex-1"></div>

          {showLocale && <Separator orientation="vertical" className="h-4" />}
          {showLocale && <LocaleSelector />}
        </div>
      ) : null}
    </>
  );
}
