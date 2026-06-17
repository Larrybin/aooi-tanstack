import { AppImage } from '@/shared/blocks/common/app-image';
import { Link } from '@/shared/blocks/common/navigation';
import {
  SidebarHeader as SidebarHeaderComponent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/shared/components/ui/sidebar';
import type { SidebarHeader as SidebarHeaderType } from '@/shared/types/blocks/workspace';

export function SidebarHeader({ header }: { header: SidebarHeaderType }) {
  const { open } = useSidebar();
  return (
    <SidebarHeaderComponent className="mb-0">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between">
          {(open || !header.show_trigger) && (
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              {header.brand && (
                <Link href={header.brand.url || ''}>
                  {header.brand.logo && (
                    <AppImage
                      src={header.brand.logo.src}
                      alt={
                        header.brand.logo.alt ||
                        header.brand.title ||
                        'Brand logo'
                      }
                      width={32}
                      height={32}
                      className="h-auto w-8 shrink-0"
                    />
                  )}
                  <span className="text-base font-semibold">
                    {header.brand.title}
                  </span>
                </Link>
              )}
            </SidebarMenuButton>
          )}
          <div className="flex-1"></div>
          {header.show_trigger && <SidebarTrigger />}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeaderComponent>
  );
}
