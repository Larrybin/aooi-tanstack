'use client';

import { Fragment } from 'react/jsx-runtime';
import { useSearchParams } from 'next/navigation';
import { signOut } from '@/infra/platform/auth/client';
import { Link, usePathname, useRouter } from '@/infra/platform/i18n/navigation';
import { filterLandingNavItems } from '@/surfaces/public/navigation/landing-visibility';
import { LogOut, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { usePublicAppContext } from '@/shared/contexts/app';
import { useAuthSnapshot } from '@/shared/contexts/auth-snapshot';
import {
  normalizeCallbackUrl,
  withCallbackUrl,
} from '@/shared/lib/callback-url';
import { cn } from '@/shared/lib/utils';
import type { NavItem, UserNav } from '@/shared/types/blocks/common';

import { SignModal } from './sign-modal';

export function SignUser({
  isScrolled,
  signButtonSize = 'sm',
  userNav,
}: {
  isScrolled?: boolean;
  signButtonSize?: 'default' | 'sm' | 'lg' | 'icon';
  userNav?: UserNav;
}) {
  const t = useTranslations('common.sign');
  const snapshot = useAuthSnapshot();
  const { isShowSignModal, setIsShowSignModal, uiConfig, authSettings } =
    usePublicAppContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userNavItems = filterLandingNavItems(userNav?.items, uiConfig);
  const canOpenInlineSignModal =
    authSettings.emailAuthEnabled ||
    authSettings.googleAuthEnabled ||
    authSettings.githubAuthEnabled;

  const search = searchParams.toString();
  const callbackUrl = normalizeCallbackUrl(
    `${pathname}${search ? `?${search}` : ''}`
  );
  const signInHref = withCallbackUrl('/sign-in', callbackUrl);

  return (
    <>
      {snapshot ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0"
              data-testid="auth-user-menu-trigger"
            >
              <Avatar>
                <AvatarImage
                  src={snapshot.image || ''}
                  alt={snapshot.name || ''}
                />
                <AvatarFallback>
                  {snapshot.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {userNav?.show_name && (
              <>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href="/settings/profile"
                  >
                    <User />
                    {snapshot.name || t('sign_in_title')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}

            {userNavItems.map((item: NavItem, idx: number) => (
              <Fragment key={idx}>
                <DropdownMenuItem asChild>
                  <Link
                    className="w-full cursor-pointer"
                    href={item.url || ''}
                    target={item.target || '_self'}
                  >
                    {item.icon && (
                      <SmartIcon
                        name={item.icon as string}
                        className="h-4 w-4"
                      />
                    )}
                    {item.title}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </Fragment>
            ))}

            {userNav?.show_sign_out && (
              <DropdownMenuItem
                className="w-full cursor-pointer"
                data-testid="auth-sign-out-trigger"
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        router.refresh();
                        router.push('/');
                      },
                    },
                  })
                }
              >
                <LogOut />
                <span>{t('sign_out_title')}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
          <Button
            asChild
            size={signButtonSize}
            className={cn(
              'border-foreground/10 ml-4 cursor-pointer ring-0',
              isScrolled && 'lg:hidden'
            )}
            aria-expanded={isShowSignModal}
            aria-haspopup="dialog"
            onClick={(event) => {
              if (!canOpenInlineSignModal) {
                return;
              }

              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.altKey ||
                event.ctrlKey ||
                event.shiftKey
              ) {
                return;
              }

              event.preventDefault();
              setIsShowSignModal(true);
            }}
          >
            <Link href={signInHref} prefetch={false}>
              <span>{t('sign_in_title')}</span>
            </Link>
          </Button>
          {canOpenInlineSignModal && <SignModal callbackUrl={callbackUrl} />}
        </div>
      )}
    </>
  );
}
