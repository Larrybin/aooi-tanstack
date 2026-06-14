import { useEffect, useState, type FormEvent } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';

import type { SettingsApiKeysCreateRouteData } from './settings-apikeys-create.types';

type SubmitApiKeyCreate = (input: {
  locale: string;
  title: string;
}) => Promise<{
  status: 'success' | 'error';
  message: string;
  redirect_url?: string;
}>;

export function SettingsApiKeysCreateRouteView({
  data,
  submitApiKeyCreate = submitSettingsApiKeyCreate,
}: {
  data: SettingsApiKeysCreateRouteData;
  submitApiKeyCreate?: SubmitApiKeyCreate;
}) {
  const [title, setTitle] = useState('');
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
      const result = await submitApiKeyCreate({
        locale: data.locale,
        title,
      });

      setMessage({ status: result.status, text: result.message });
      if (result.status === 'success') {
        setTitle('');
        if (result.redirect_url) {
          window.location.assign(result.redirect_url);
        }
      }
    } catch (error) {
      setMessage({
        status: 'error',
        text:
          error instanceof Error ? error.message : 'API key creation failed',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsShellView shell={data.shell}>
      {!data.viewer.signedIn ? (
        <section className="settings-panel">
          <p>{data.page.noAuthMessage}</p>
        </section>
      ) : (
        <section className="settings-panel">
          <nav aria-label={data.page.title}>
            <a href={data.page.backHref}>{data.page.labels.apiKeys}</a>
          </nav>
          <h2>{data.page.title}</h2>
          <form className="settings-profile-list" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="settings-apikey-title">
                {data.page.fields.title}
              </label>
              <input
                id="settings-apikey-title"
                name="title"
                type="text"
                value={title}
                required
                onChange={(event) => setTitle(event.currentTarget.value)}
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

async function submitSettingsApiKeyCreate(input: {
  locale: string;
  title: string;
}) {
  const { submitSettingsApiKeyCreateRouteSurfaceData } =
    await import('./settings-apikeys-create.data');

  return submitSettingsApiKeyCreateRouteSurfaceData(input);
}
