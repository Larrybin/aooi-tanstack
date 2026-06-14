import { useEffect, useState, type FormEvent } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';

import type {
  SettingsApiKeyIdMutationResult,
  SettingsApiKeysIdRouteData,
} from './settings-apikeys-id.types';

type SubmitApiKeyEdit = (input: {
  locale: string;
  id: string;
  title: string;
}) => Promise<SettingsApiKeyIdMutationResult>;

type SubmitApiKeyDelete = SubmitApiKeyEdit;

export function SettingsApiKeysIdRouteView({
  data,
  submitApiKeyEdit = submitSettingsApiKeyEdit,
  submitApiKeyDelete = submitSettingsApiKeyDelete,
}: {
  data: SettingsApiKeysIdRouteData;
  submitApiKeyEdit?: SubmitApiKeyEdit;
  submitApiKeyDelete?: SubmitApiKeyDelete;
}) {
  const apikey = data.page.apikey;
  const routeKey = `${data.page.mode}:${apikey?.id ?? 'none'}`;

  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <SettingsShellView shell={data.shell}>
      {!data.viewer.signedIn ? (
        <section className="settings-panel">
          <p>{data.page.noAuthMessage}</p>
        </section>
      ) : !apikey ? (
        <section className="settings-panel">
          <p>{data.page.message ?? data.page.noPermissionMessage}</p>
        </section>
      ) : (
        <SettingsApiKeyForm
          key={routeKey}
          data={data}
          apikey={apikey}
          submitApiKeyEdit={submitApiKeyEdit}
          submitApiKeyDelete={submitApiKeyDelete}
        />
      )}
    </SettingsShellView>
  );
}

function SettingsApiKeyForm({
  data,
  apikey,
  submitApiKeyEdit,
  submitApiKeyDelete,
}: {
  data: SettingsApiKeysIdRouteData;
  apikey: NonNullable<SettingsApiKeysIdRouteData['page']['apikey']>;
  submitApiKeyEdit: SubmitApiKeyEdit;
  submitApiKeyDelete: SubmitApiKeyDelete;
}) {
  const [message, setMessage] = useState<{
    status: 'success' | 'error';
    text: string;
  } | null>(
    data.page.message
      ? {
          status: 'error',
          text: data.page.message,
        }
      : null
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);
    setMessage(null);

    try {
      const submit =
        data.page.mode === 'edit' ? submitApiKeyEdit : submitApiKeyDelete;
      const result = await submit({
        locale: data.locale,
        id: apikey.id,
        title: readSubmissionTitle(
          data.page.mode,
          event.currentTarget,
          apikey.title
        ),
      });

      setMessage({ status: result.status, text: result.message });
      if (result.status === 'success' && result.redirect_url) {
        window.location.assign(result.redirect_url);
      }
    } catch (error) {
      setMessage({
        status: 'error',
        text: error instanceof Error ? error.message : 'API key update failed',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="settings-panel">
      <nav aria-label={data.page.title}>
        <a href={data.page.backHref}>{data.page.labels.apiKeys}</a>
      </nav>
      <h2>{data.page.title}</h2>
      <form className="settings-profile-list" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="settings-apikey-title">
            {data.page.labels.title}
          </label>
          <input
            id="settings-apikey-title"
            name="title"
            type="text"
            defaultValue={apikey.title}
            required
            disabled={data.page.mode === 'delete'}
          />
        </div>
        {data.page.mode === 'delete' ? (
          <div>
            <label htmlFor="settings-apikey-key">{data.page.labels.key}</label>
            <input
              id="settings-apikey-key"
              name="key"
              type="text"
              value={apikey.key ?? ''}
              disabled
              readOnly
            />
          </div>
        ) : null}
        {message ? <p data-status={message.status}>{message.text}</p> : null}
        <button type="submit" disabled={submitting}>
          {data.page.labels.submit}
        </button>
      </form>
    </section>
  );
}

function readSubmissionTitle(
  mode: 'edit' | 'delete',
  form: HTMLFormElement,
  apikeyTitle: string
) {
  if (mode === 'delete') {
    return apikeyTitle;
  }

  const title = new FormData(form).get('title');
  return typeof title === 'string' ? title : '';
}

async function submitSettingsApiKeyEdit(input: {
  locale: string;
  id: string;
  title: string;
}) {
  const { submitSettingsApiKeyUpdateRouteSurfaceData } =
    await import('./settings-apikeys-id.data');

  return submitSettingsApiKeyUpdateRouteSurfaceData(input);
}

async function submitSettingsApiKeyDelete(input: {
  locale: string;
  id: string;
  title: string;
}) {
  const { submitSettingsApiKeyDeleteRouteSurfaceData } =
    await import('./settings-apikeys-id.data');

  return submitSettingsApiKeyDeleteRouteSurfaceData(input);
}
