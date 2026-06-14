import { useEffect, useState } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';

import type { SettingsCreditsRouteData } from './settings-credits.types';

export function SettingsCreditsRouteView({
  data,
}: {
  data: SettingsCreditsRouteData;
}) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
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

  async function copyTransactionNo(transactionNo: string) {
    if (!transactionNo || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(transactionNo);
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
          <section className="settings-panel">
            <h2>{data.page.labels.balanceTitle}</h2>
            <div className="settings-credits-balance">
              {data.page.remainingCredits}
            </div>
            <a className="settings-action-link" href={data.page.purchaseUrl}>
              {data.page.labels.purchaseButton}
            </a>
          </section>
          <section className="settings-panel">
            <h2>{data.page.labels.listTitle}</h2>
            <nav
              className="settings-filter-tabs"
              aria-label={data.page.labels.type}
            >
              {data.page.tabs.map((tab) => (
                <a
                  key={tab.type}
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
                    <th>{data.page.labels.transactionNo}</th>
                    <th>{data.page.labels.description}</th>
                    <th>{data.page.labels.type}</th>
                    <th>{data.page.labels.scene}</th>
                    <th>{data.page.labels.credits}</th>
                    <th>{data.page.labels.expiresAt}</th>
                    <th>{data.page.labels.createdAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.page.records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        {record.transactionNo || '-'}
                        {record.transactionNo ? (
                          <button
                            type="button"
                            onClick={() =>
                              copyTransactionNo(record.transactionNo)
                            }
                          >
                            {data.page.labels.copyAction}
                          </button>
                        ) : null}
                      </td>
                      <td>{record.description || '-'}</td>
                      <td>{record.transactionType || '-'}</td>
                      <td>{record.transactionScene || '-'}</td>
                      <td>{record.credits}</td>
                      <td>{record.expiresAt ?? '-'}</td>
                      <td>{record.createdAt ?? '-'}</td>
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
