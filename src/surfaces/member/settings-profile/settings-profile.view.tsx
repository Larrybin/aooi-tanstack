import { useEffect, useState, type FormEvent } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';

import { submitSettingsProfileRouteSurfaceData } from './settings-profile.data';
import type { SettingsProfileRouteData } from './settings-profile.types';

export function SettingsProfileRouteView({
  data,
}: {
  data: SettingsProfileRouteData;
}) {
  const profile = data.page.profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [image, setImage] = useState(profile?.image ?? '');
  const [message, setMessage] = useState<{
    status: 'success' | 'error';
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const result = await submitSettingsProfileRouteSurfaceData({
        locale: data.locale,
        name,
        image,
      });

      setMessage({ status: result.status, text: result.message });
      if (result.status === 'success' && result.profile) {
        setName(result.profile.name);
        setImage(result.profile.image ?? '');
      }
    } catch (error) {
      setMessage({
        status: 'error',
        text: error instanceof Error ? error.message : 'Profile update failed',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsShellView shell={data.shell}>
      {!data.viewer.signedIn || !profile ? (
        <section className="settings-panel">
          <p>{data.page.noAuthMessage}</p>
        </section>
      ) : (
        <section className="settings-panel">
          <h2>{data.page.title}</h2>
          <p>{data.page.description}</p>
          <form className="settings-profile-list" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="settings-profile-email">
                {data.page.fields.email}
              </label>
              <input
                id="settings-profile-email"
                type="email"
                value={profile.email}
                disabled
              />
            </div>
            <div>
              <label htmlFor="settings-profile-name">
                {data.page.fields.name}
              </label>
              <input
                id="settings-profile-name"
                name="name"
                type="text"
                value={name}
                required
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </div>
            <div>
              <label htmlFor="settings-profile-image">
                {data.page.fields.avatar}
              </label>
              <input
                id="settings-profile-image"
                name="image"
                type="text"
                value={image}
                onChange={(event) => setImage(event.currentTarget.value)}
              />
            </div>
            {message ? (
              <p data-status={message.status}>{message.text}</p>
            ) : null}
            <button type="submit" disabled={submitting}>
              {data.page.submitButtonTitle}
            </button>
          </form>
        </section>
      )}
    </SettingsShellView>
  );
}
