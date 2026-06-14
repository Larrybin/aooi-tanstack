import { useEffect, useRef, useState } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';
import { fetchJson, toastFetchError } from '@/shared/lib/api/fetch-json';

import type { SettingsBillingRouteData } from './settings-billing.types';

export function SettingsBillingRouteView({
  data,
}: {
  data: SettingsBillingRouteData;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const didConfirmPaymentCallback = useRef(false);
  const paymentCallback = data.page.paymentCallback;
  const totalPages = Math.max(
    1,
    Math.ceil(data.page.pagination.total / data.page.pagination.pageSize)
  );
  const hasPagination = Boolean(
    data.page.pagination.previousHref || data.page.pagination.nextHref
  );

  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  useEffect(() => {
    if (
      !data.viewer.signedIn ||
      !paymentCallback ||
      didConfirmPaymentCallback.current
    ) {
      return;
    }

    didConfirmPaymentCallback.current = true;
    void fetchJson('/api/payment/callback', {
      method: 'POST',
      body: { order_no: paymentCallback.orderNo },
    })
      .then(() => {
        window.location.replace(paymentCallback.cleanUrl);
      })
      .catch((error: unknown) => {
        setCallbackError(data.page.labels.callbackFailed);
        toastFetchError(error, data.page.labels.callbackFailed);
      });
  }, [data.page.labels.callbackFailed, data.viewer.signedIn, paymentCallback]);

  async function copySubscriptionNo(subscriptionNo: string) {
    if (!subscriptionNo || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(subscriptionNo);
    setCopyMessage(data.page.labels.copySuccess);
  }

  return (
    <SettingsShellView shell={data.shell}>
      {!data.viewer.signedIn ? (
        <section className="settings-panel">
          <p>{data.page.noAuthMessage}</p>
        </section>
      ) : (
        <div className="settings-panel-list">
          {data.page.paymentCallback ? (
            <section className="settings-panel">
              <h2>{data.page.labels.callbackTitle}</h2>
              <p>
                {data.page.labels.callbackOrderNo}:{' '}
                {data.page.paymentCallback.orderNo}
              </p>
              <a href={data.page.paymentCallback.cleanUrl}>
                {data.page.labels.callbackClear}
              </a>
              {callbackError ? (
                <p data-status="error">{callbackError}</p>
              ) : null}
            </section>
          ) : null}
          <section className="settings-panel">
            <h2>{data.page.labels.currentPlanTitle}</h2>
            <div className="settings-billing-plan">
              {data.page.currentSubscription?.planName ||
                data.page.labels.noSubscription}
            </div>
            {data.page.currentSubscription?.status ? (
              <p>{data.page.currentSubscription.status}</p>
            ) : null}
            {data.page.currentSubscription?.tip ? (
              <p>{data.page.currentSubscription.tip}</p>
            ) : null}
            <a className="settings-action-link" href={data.page.purchaseUrl}>
              {data.page.currentSubscription
                ? data.page.labels.adjustButton
                : data.page.labels.subscribeButton}
            </a>
            {data.page.currentSubscription?.manageHref ? (
              <a
                className="settings-action-link"
                href={data.page.currentSubscription.manageHref}
              >
                {data.page.labels.manageButton}
              </a>
            ) : null}
          </section>
          <section className="settings-panel">
            <h2>{data.page.labels.listTitle}</h2>
            <nav
              className="settings-filter-tabs"
              aria-label={data.page.labels.status}
            >
              {data.page.tabs.map((tab) => (
                <a
                  key={tab.status}
                  href={tab.href}
                  aria-current={tab.active ? 'page' : undefined}
                >
                  {tab.title}
                </a>
              ))}
            </nav>
            {data.page.errorMessage ? (
              <p data-status="error">{data.page.errorMessage}</p>
            ) : null}
            {copyMessage ? <p>{copyMessage}</p> : null}
            {data.page.records.length === 0 ? (
              <p>{data.page.labels.empty}</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{data.page.labels.subscriptionNo}</th>
                    <th>{data.page.labels.interval}</th>
                    <th>{data.page.labels.status}</th>
                    <th>{data.page.labels.amount}</th>
                    <th>{data.page.labels.createdAt}</th>
                    <th>{data.page.labels.currentPeriod}</th>
                    <th>{data.page.labels.endTime}</th>
                    <th>{data.page.labels.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.page.records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {record.subscriptionNo || '-'}
                        {record.subscriptionNo ? (
                          <button
                            type="button"
                            onClick={() =>
                              copySubscriptionNo(record.subscriptionNo)
                            }
                          >
                            {data.page.labels.copyAction}
                          </button>
                        ) : null}
                      </td>
                      <td>{record.interval}</td>
                      <td>{record.status || '-'}</td>
                      <td>{record.amount}</td>
                      <td>{record.createdAt}</td>
                      <td>{record.currentPeriod}</td>
                      <td>{record.endTime}</td>
                      <td>
                        {record.actions.cancelHref ? (
                          <a href={record.actions.cancelHref}>
                            {data.page.labels.cancelButton}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hasPagination ? (
              <nav
                className="settings-pagination"
                aria-label={data.page.labels.listTitle}
              >
                {data.page.pagination.previousHref ? (
                  <a href={data.page.pagination.previousHref}>
                    {data.page.labels.previousPage}
                  </a>
                ) : null}
                <span>
                  {data.page.pagination.page} / {totalPages}
                </span>
                {data.page.pagination.nextHref ? (
                  <a href={data.page.pagination.nextHref}>
                    {data.page.labels.nextPage}
                  </a>
                ) : null}
              </nav>
            ) : null}
          </section>
        </div>
      )}
    </SettingsShellView>
  );
}
