import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import type { SettingsSecurityRouteData } from './settings-security.types';

export function SettingsSecurityRouteView({
  data,
}: {
  data: SettingsSecurityRouteData;
}) {
  return (
    <SettingsShellView shell={data.shell}>
      {!data.viewer.signedIn ? (
        <section className="settings-panel">
          <p>{data.page.noAuthMessage}</p>
        </section>
      ) : (
        <div className="settings-panel-list">
          <section className="settings-panel">
            <h2>{data.page.resetPassword.title}</h2>
            <p>{data.page.resetPassword.description}</p>
            <p className="settings-panel-tip">{data.page.resetPassword.tip}</p>
            <a
              className="settings-action-link"
              href={data.page.resetPassword.button.href}
            >
              {data.page.resetPassword.button.title}
            </a>
          </section>
          <section className="settings-panel">
            <h2>{data.page.deleteAccount.title}</h2>
            <p>{data.page.deleteAccount.description}</p>
            <p className="settings-panel-tip">{data.page.deleteAccount.tip}</p>
          </section>
        </div>
      )}
    </SettingsShellView>
  );
}
