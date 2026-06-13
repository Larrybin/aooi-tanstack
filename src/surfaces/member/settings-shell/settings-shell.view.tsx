import type { ReactNode } from 'react';

import type { SettingsShellData } from './settings-shell.types';

export function SettingsShellView({
  shell,
  children,
}: {
  shell: SettingsShellData;
  children: ReactNode;
}) {
  return (
    <div className="settings-shell">
      <header className="settings-shell-header">
        <h1>{shell.title}</h1>
        <nav className="settings-top-nav" aria-label="Settings top navigation">
          {shell.topNav.items.map((item) => (
            <a key={item.url} href={item.url}>
              {item.title}
            </a>
          ))}
        </nav>
      </header>
      <div className="settings-shell-body">
        <aside className="settings-sidebar">
          <nav aria-label="Settings navigation">
            {shell.nav.items.map((item) => (
              <a key={item.url} href={item.url}>
                {item.title}
              </a>
            ))}
          </nav>
        </aside>
        <main className="settings-content">{children}</main>
      </div>
    </div>
  );
}
