'use client';

import { Fragment } from 'react';
import { signOut } from '@/infra/platform/auth/client';
import { Link, useRouter } from '@/infra/platform/i18n/navigation';
import { ChevronsUpDown, LogOut, User } from 'lucide-react';
import { useTranslations } from '@/shared/lib/i18n/native';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/components/ui/sidebar';
import { usePublicAppContext } from '@/shared/contexts/app';
import { useAuthSnapshot } from '@/shared/contexts/auth-snapshot';
import type { AuthSessionUserSnapshot } from '@/shared/types/auth-session';
import type { NavItem } from '@/shared/types/blocks/common';
import type { SidebarUser as SidebarUserType } from '@/shared/types/blocks/workspace';

type SidebarUserProps = {
  user: SidebarUserType;
  initialUser?: AuthSessionUserSnapshot | null;
};

export function SidebarUser({ user, initialUser }: SidebarUserProps) {
  const t = useTranslations('common.sign');
  const { isMobile, open } = useSidebar();
  const router = useRouter();
  const snapshot = useAuthSnapshot();
  const { setIsShowSignModal } = usePublicAppContext();

  const handleSignOut = async () => {
    await signOut();
    router.refresh();
    router.push(user.signout_callback || '/sign-in');
  };

  const authUser: AuthSessionUserSnapshot | null =
    snapshot ?? initialUser ?? null;

  if (authUser) {
    return (
      <SidebarMenu className="gap-4 px-3">
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="auth-user-menu-trigger"
              >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={authUser.image || ''}
                    alt={authUser.name || undefined}
                  />
                  <AvatarFallback className="rounded-lg">
                    {authUser.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {authUser.name}
                  </span>
                  {user.show_email && (
                    <span className="truncate text-xs">{authUser.email}</span>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="bg-background w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={authUser.image || ''}
                      alt={authUser.name || undefined}
                    />
                    <AvatarFallback className="rounded-lg">
                      {authUser.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {authUser.name}
                    </span>
                    {user.show_email && (
                      <span className="truncate text-xs">{authUser.email}</span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {user.nav?.items.map((item: NavItem | undefined) => (
                  <Fragment key={item?.title || item?.url}>
                    <DropdownMenuItem className="cursor-pointer">
                      <Link
                        href={item?.url || ''}
                        target={item?.target}
                        className="flex w-full items-center gap-2"
                      >
                        {item?.icon && <SmartIcon name={item.icon as string} />}
                        {item?.title || ''}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </Fragment>
                ))}
                <DropdownMenuItem
                  className="cursor-pointer"
                  data-testid="auth-sign-out-trigger"
                  onClick={handleSignOut}
                >
                  <LogOut />
                  {t('sign_out_title')}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  // When user is not logged in
  return (
    <>
      {open ? (
        <div className="flex h-full items-center justify-center px-4 py-4">
          <Button className="w-full" onClick={() => setIsShowSignModal(true)}>
            <User className="mr-1 h-4 w-4" />
            {t('sign_in_title')}
          </Button>
        </div>
      ) : (
        <SidebarMenu />
      )}
    </>
  );
}
