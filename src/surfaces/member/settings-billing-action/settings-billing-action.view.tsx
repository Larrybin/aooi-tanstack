import { useEffect, useState, type FormEvent } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';

import type { SettingsBillingActionRouteData } from './settings-billing-action.types';

export function SettingsBillingActionRouteView({
  data,
}: {
  data: SettingsBillingActionRouteData;
}) {
  const [message, setMessage] = useState<{
    status: 'success' | 'error';
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  async function handleCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data.page.query.subscriptionNo) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const { submitSettingsBillingCancelRouteSurfaceData } =
        await import('./settings-billing-action.data');
      const result = await submitSettingsBillingCancelRouteSurfaceData({
        locale: data.locale,
        subscriptionNo: data.page.query.subscriptionNo,
      });

      setMessage({ status: result.status, text: result.message });
      if (result.status === 'success' && result.redirectTo) {
        window.location.assign(result.redirectTo);
      }
    } catch (error) {
      setMessage({
        status: 'error',
        text: error instanceof Error ? error.message : data.page.message || '',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SettingsShellView shell={data.shell}>
      {data.page.kind === 'cancel' && data.page.subscription ? (
        <section className="settings-panel">
          <h2>{data.page.title}</h2>
          <p>{data.page.description}</p>
          <form className="settings-profile-list" onSubmit={handleCancel}>
            <div>
              <label htmlFor="settings-billing-cancel-subscription-no">
                {data.page.labels.subscriptionNo}
              </label>
              <input
                id="settings-billing-cancel-subscription-no"
                type="text"
                value={data.page.subscription.subscriptionNo}
                disabled
              />
            </div>
            <div>
              <label htmlFor="settings-billing-cancel-amount">
                {data.page.labels.subscriptionAmount}
              </label>
              <input
                id="settings-billing-cancel-amount"
                type="text"
                value={data.page.subscription.amount}
                disabled
              />
            </div>
            <div>
              <label htmlFor="settings-billing-cancel-interval">
                {data.page.labels.intervalCycle}
              </label>
              <input
                id="settings-billing-cancel-interval"
                type="text"
                value={data.page.subscription.intervalCycle}
                disabled
              />
            </div>
            <div>
              <label htmlFor="settings-billing-cancel-created-at">
                {data.page.labels.subscriptionCreatedAt}
              </label>
              <input
                id="settings-billing-cancel-created-at"
                type="text"
                value={data.page.subscription.createdAt}
                disabled
              />
            </div>
            <div>
              <label htmlFor="settings-billing-cancel-current-period">
                {data.page.labels.currentPeriod}
              </label>
              <input
                id="settings-billing-cancel-current-period"
                type="text"
                value={data.page.subscription.currentPeriod}
                disabled
              />
            </div>
            {message ? (
              <p data-status={message.status}>{message.text}</p>
            ) : null}
            <button type="submit" disabled={submitting}>
              {data.page.labels.submit}
            </button>
            <a href={data.page.backHref}>{data.page.labels.back}</a>
          </form>
        </section>
      ) : (
        <section className="settings-panel">
          <h2>{data.page.title}</h2>
          {data.page.message ? <p>{data.page.message}</p> : null}
          <a href={data.page.backHref}>{data.page.labels.back}</a>
        </section>
      )}
    </SettingsShellView>
  );
}
