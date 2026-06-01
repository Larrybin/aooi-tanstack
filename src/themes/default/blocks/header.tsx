'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { SignUser } from '@/domains/account/ui/auth/sign-user';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';
import { Link, usePathname } from '@/infra/platform/i18n/navigation';
import { filterLandingNavItems } from '@/surfaces/public/navigation/landing-visibility';
import { Menu, X } from 'lucide-react';

import { BrandLogo } from '@/shared/blocks/common/brand-logo';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger as RawNavigationMenuTrigger,
} from '@/shared/components/ui/navigation-menu';
import { listenEvent } from '@/shared/lib/dom/event-listener';
import { cn } from '@/shared/lib/utils';
import type { NavItem } from '@/shared/types/blocks/common';
import type { Header as HeaderType } from '@/shared/types/blocks/landing';

function NavigationMenuTrigger(
  props: React.ComponentProps<typeof RawNavigationMenuTrigger>
) {
  return <RawNavigationMenuTrigger {...props} />;
}

function SignUserSuspense({ userNav }: { userNav?: HeaderType['user_nav'] }) {
  return (
    <Suspense fallback={null}>
      <SignUser userNav={userNav} />
    </Suspense>
  );
}

export function Header({
  header,
  publicConfig,
}: {
  header: HeaderType;
  publicConfig?: PublicUiConfig;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const navItems = filterLandingNavItems(header.nav?.items, publicConfig);

  useEffect(() => {
    // Listen to scroll event to enable header styles on scroll
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    return listenEvent(window, 'scroll', handleScroll);
  }, []);

  // Navigation menu for large screens
  const NavMenu = () => {
    const menuRef = useRef<React.ElementRef<typeof NavigationMenu>>(null);

    // Calculate dynamic viewport height for animated menu
    const handleViewportHeight = () => {
      requestAnimationFrame(() => {
        const menuNode = menuRef.current;
        if (!menuNode) return;

        const openContent = document.querySelector<HTMLElement>(
          '[data-slot="navigation-menu-viewport"][data-state="open"]'
        );

        if (openContent) {
          const height = openContent.scrollHeight;
          document.documentElement.style.setProperty(
            '--navigation-menu-viewport-height',
            `${height}px`
          );
        } else {
          document.documentElement.style.removeProperty(
            '--navigation-menu-viewport-height'
          );
        }
      });
    };

    return (
      <NavigationMenu
        ref={menuRef}
        onValueChange={handleViewportHeight}
        className="[--color-muted:color-mix(in_oklch,var(--color-foreground)_5%,transparent)] [--viewport-outer-px:2rem] **:data-[slot=navigation-menu-viewport]:rounded-none **:data-[slot=navigation-menu-viewport]:border-0 **:data-[slot=navigation-menu-viewport]:bg-transparent **:data-[slot=navigation-menu-viewport]:shadow-none **:data-[slot=navigation-menu-viewport]:ring-0 max-lg:hidden"
      >
        <NavigationMenuList className="gap-3">
          {navItems.map((item, idx) => (
            <NavigationMenuItem key={idx} value={item.title || ''}>
              {item.children && item.children.length > 0 ? (
                <>
                  <NavigationMenuTrigger className="flex flex-row items-center gap-2 text-sm">
                    {item.icon && (
                      <SmartIcon
                        name={item.icon as string}
                        className="h-4 w-4"
                      />
                    )}
                    {item.title}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="mt-4.5 origin-top pt-5 pb-14 shadow-none ring-0">
                    <div className="divide-foreground/10 grid w-full min-w-6xl grid-cols-4 gap-4 divide-x pr-22">
                      <div className="col-span-2 row-span-2 grid grid-rows-subgrid gap-1 border-r-0">
                        <span className="text-muted-foreground ml-2 text-xs">
                          {item.title}
                        </span>
                        <ul className="mt-1 grid grid-cols-2 gap-2">
                          {item.children?.map((subItem: NavItem, iidx) => (
                            <ListItem
                              key={iidx}
                              href={subItem.url || ''}
                              title={subItem.title || ''}
                              description={subItem.description || ''}
                            >
                              {subItem.icon && (
                                <SmartIcon name={subItem.icon as string} />
                              )}
                            </ListItem>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </>
              ) : (
                <NavigationMenuLink asChild>
                  <Link
                    href={item.url || ''}
                    target={item.target || '_self'}
                    className={`flex flex-row items-center gap-2 text-sm ${
                      item.is_active || pathname.endsWith(item.url as string)
                        ? 'bg-muted text-muted-foreground'
                        : ''
                    }`}
                  >
                    {item.icon && <SmartIcon name={item.icon as string} />}
                    {item.title}
                  </Link>
                </NavigationMenuLink>
              )}
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
    );
  };

  // Mobile menu using Accordion, shown on small screens
  const MobileMenu = ({ closeMenu }: { closeMenu: () => void }) => {
    return (
      <nav
        role="navigation"
        className="w-full [--color-border:--alpha(var(--color-foreground)/5%)] [--color-muted:--alpha(var(--color-foreground)/5%)]"
      >
        <Accordion
          type="single"
          collapsible
          className="-mx-4 mt-0.5 space-y-0.5 **:hover:no-underline"
        >
          {navItems.map((item, idx) => {
            return (
              <AccordionItem
                key={idx}
                value={item.title || ''}
                className="group relative border-b-0 before:pointer-events-none before:absolute before:inset-x-4 before:bottom-0 before:border-b"
              >
                {item.children && item.children.length > 0 ? (
                  <>
                    <AccordionTrigger className="data-[state=open]:bg-muted flex items-center justify-between px-4 py-3 text-lg **:!font-normal">
                      {item.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5">
                      <ul>
                        {item.children?.map((subItem: NavItem, iidx) => (
                          <li key={iidx}>
                            <Link
                              href={subItem.url || ''}
                              onClick={closeMenu}
                              className="grid grid-cols-[auto_1fr] items-center gap-2.5 px-4 py-2"
                            >
                              <div
                                aria-hidden
                                className="flex items-center justify-center *:size-4"
                              >
                                {subItem.icon && (
                                  <SmartIcon name={subItem.icon as string} />
                                )}
                              </div>
                              <div className="text-base">{subItem.title}</div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </>
                ) : (
                  <Link
                    href={item.url || ''}
                    onClick={closeMenu}
                    className="data-[state=open]:bg-muted flex items-center justify-between px-4 py-3 text-lg **:!font-normal"
                  >
                    {item.title}
                  </Link>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </nav>
    );
  };

  // List item for submenus in NavigationMenu
  function ListItem({
    title,
    description,
    children,
    href,
    ...props
  }: React.ComponentPropsWithoutRef<'li'> & {
    href: string;
    title: string;
    description?: string;
  }) {
    return (
      <li {...props}>
        <NavigationMenuLink asChild>
          <Link href={href} className="grid grid-cols-[auto_1fr] gap-3.5">
            <div className="bg-background ring-foreground/10 relative flex size-9 items-center justify-center rounded border border-transparent shadow shadow-sm ring-1">
              {children}
            </div>
            <div className="space-y-0.5">
              <div className="text-foreground text-sm font-medium">{title}</div>
              <p className="text-muted-foreground line-clamp-1 text-xs">
                {description}
              </p>
            </div>
          </Link>
        </NavigationMenuLink>
      </li>
    );
  }

  return (
    <>
      <header
        data-state={isMobileMenuOpen ? 'active' : 'inactive'}
        {...(isScrolled && { 'data-scrolled': true })}
        className="has-data-[state=open]:bg-background/50 fixed inset-x-0 top-0 z-50 has-data-[state=open]:h-screen has-data-[state=open]:backdrop-blur"
      >
        <div
          className={cn(
            'absolute inset-x-0 top-0 z-50 h-18 border-transparent ring-1 ring-transparent transition-all duration-300',
            'in-data-scrolled:border-foreground/5 in-data-scrolled:bg-background/75 in-data-scrolled:border-b in-data-scrolled:backdrop-blur',
            'has-data-[state=open]:ring-foreground/5 has-data-[state=open]:bg-card/75 has-data-[state=open]:h-[calc(var(--navigation-menu-viewport-height)+3.4rem)] has-data-[state=open]:border-b has-data-[state=open]:shadow-lg has-data-[state=open]:shadow-black/10 has-data-[state=open]:backdrop-blur',
            'max-lg:in-data-[state=active]:bg-background/75 max-lg:h-14 max-lg:overflow-hidden max-lg:border-b max-lg:in-data-[state=active]:h-screen max-lg:in-data-[state=active]:backdrop-blur'
          )}
        >
          <div className="container">
            <div className="relative flex flex-wrap items-center justify-between lg:py-5">
              <div className="flex justify-between gap-8 max-lg:h-14 max-lg:w-full max-lg:border-b">
                {/* Brand Logo */}
                {header.brand && <BrandLogo brand={header.brand} />}

                {/* Desktop Navigation Menu */}
                <NavMenu />
                {/* Hamburger menu button for mobile navigation */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label={
                    isMobileMenuOpen == true ? 'Close Menu' : 'Open Menu'
                  }
                  className="relative z-20 -m-2.5 -mr-3 block cursor-pointer p-2.5 lg:hidden"
                >
                  <Menu className="m-auto size-5 duration-200 in-data-[state=active]:scale-0 in-data-[state=active]:rotate-180 in-data-[state=active]:opacity-0" />
                  <X className="absolute inset-0 m-auto size-5 scale-0 -rotate-180 opacity-0 duration-200 in-data-[state=active]:scale-100 in-data-[state=active]:rotate-0 in-data-[state=active]:opacity-100" />
                </button>
              </div>

              {/* Show mobile menu if needed */}
              {isMobileMenuOpen && (
                <div className="lg:hidden">
                  <MobileMenu closeMenu={() => setIsMobileMenuOpen(false)} />
                </div>
              )}

              {/* Header right section: sign and buttons */}
              <div className="mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 in-data-[state=active]:flex max-lg:in-data-[state=active]:mt-6 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none">
                <div className="flex w-full flex-row items-center gap-4 sm:flex-row sm:gap-6 sm:space-y-0 md:w-fit">
                  <div className="flex-1 md:hidden"></div>
                  {header.show_sign ? (
                    <SignUserSuspense userNav={header.user_nav} />
                  ) : null}

                  {header.buttons &&
                    header.buttons.map((button, idx) => (
                      <Link
                        key={idx}
                        href={button.url || ''}
                        target={button.target || '_self'}
                        className={cn(
                          'focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                          'h-7 px-3 ring-0',
                          button.variant === 'outline'
                            ? 'bg-background ring-foreground/10 hover:bg-muted/50 border border-transparent shadow-sm ring-1 shadow-black/15 duration-200'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 border-[0.5px] border-white/25 shadow-md ring-1 shadow-black/20 ring-(--ring-color) [--ring-color:color-mix(in_oklab,var(--color-foreground)15%,var(--color-primary))]'
                        )}
                      >
                        {button.icon && (
                          <SmartIcon name={button.icon as string} />
                        )}
                        <span>{button.title}</span>
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
