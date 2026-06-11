import type { ReactNode } from 'react';

import { LocaleDetector } from '@/shared/blocks/common/locale-detector';
import { PublicAppProvider } from '@/shared/contexts/app';

import type {
  SlugShellData,
  SlugShellNavItem,
} from '../slug/slug.types';

function NavLinks({
  items,
  className,
}: {
  items: SlugShellNavItem[];
  className: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav className={className} aria-label="Navigation">
      {items.map((item) => (
        <NavLink key={`${item.title}:${item.url ?? ''}`} item={item} />
      ))}
    </nav>
  );
}

function NavLink({ item }: { item: SlugShellNavItem }) {
  const label = item.title;
  const href = item.url || '#';

  return (
    <a href={href} target={item.target} rel={item.target ? 'noreferrer' : undefined}>
      {label}
    </a>
  );
}

export function LandingShellView({
  children,
  shell,
}: {
  children: ReactNode;
  shell: SlugShellData;
}) {
  return (
    <PublicAppProvider
      initialUiConfig={shell.publicUiConfig}
      initialAuthSettings={shell.authSettings}
      initialBillingSettings={shell.billingSettings}
    >
      <LocaleDetector />
      <div className="landing-shell">
        <header className="landing-shell-header">
          <a className="landing-shell-brand" href={shell.brand.url || '/'}>
            {shell.brand.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- TanStack routes cannot use next/image.
              <img
                src={shell.brand.logo.src}
                alt={shell.brand.logo.alt}
                aria-hidden={shell.brand.logo.alt ? undefined : true}
              />
            ) : null}
            <span>{shell.brand.title}</span>
          </a>

          <div className="landing-shell-header-actions">
            <NavLinks
              items={shell.header.navItems}
              className="landing-shell-nav"
            />
            <NavLinks
              items={shell.header.userNavItems}
              className="landing-shell-user-nav"
            />
            <NavLinks
              items={shell.header.buttonItems}
              className="landing-shell-button-nav"
            />
            {shell.header.showSign ? (
              <a className="landing-shell-sign-link" href={shell.header.signInHref}>
                {shell.header.signInLabel}
              </a>
            ) : null}
          </div>
        </header>

        <main className="landing-shell-main">{children}</main>

        <footer className="landing-shell-footer">
          <div className="landing-shell-footer-brand">
            <strong>{shell.brand.title}</strong>
            {shell.brand.description ? <p>{shell.brand.description}</p> : null}
            <span>{shell.footer.copyright}</span>
          </div>

          {shell.footer.groups.length > 0 ? (
            <div className="landing-shell-footer-groups">
              {shell.footer.groups.map((group) => (
                <nav
                  key={group.title || group.items.map((item) => item.title).join(':')}
                  aria-label={group.title || shell.footer.ariaLabel}
                >
                  {group.title ? <strong>{group.title}</strong> : null}
                  {group.items.map((item) => (
                    <NavLink key={`${item.title}:${item.url ?? ''}`} item={item} />
                  ))}
                </nav>
              ))}
            </div>
          ) : null}

          <NavLinks
            items={shell.footer.agreementItems}
            className="landing-shell-legal-nav"
          />
        </footer>
      </div>
    </PublicAppProvider>
  );
}
