import type { ReactNode } from 'react';

import { Toaster } from '@/shared/components/ui/sonner';

import type { AuthShellData } from './auth-route.types';

export function AuthShellView({
  children,
  shell,
}: {
  children: ReactNode;
  shell: AuthShellData;
}) {
  return (
    <div className="auth-shell">
      <Toaster position="top-center" richColors />

      <header className="auth-shell-topbar">
        <a className="auth-shell-brand" href={shell.brand.url}>
          {shell.brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- TanStack routes cannot use next/image.
            <img src={shell.brand.logo.src} alt={shell.brand.logo.alt} />
          ) : null}
          <span>{shell.brand.title}</span>
        </a>

        {shell.localeSwitcherEnabled ? (
          <nav
            className="auth-locale-switcher"
            aria-label={shell.localeSwitcherAriaLabel}
          >
            {shell.localeOptions.map((item) => (
              <a
                key={item.locale}
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="auth-shell-main">
        <section className="auth-shell-copy" aria-label={shell.brand.title}>
          <p className="auth-shell-eyebrow">{shell.copy.eyebrow}</p>
          <h1>{shell.copy.title}</h1>
          <p>{shell.copy.description}</p>
          {shell.copy.points.length > 0 ? (
            <div className="auth-shell-points">
              {shell.copy.points.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="auth-form-slot">{children}</section>
      </main>
    </div>
  );
}
