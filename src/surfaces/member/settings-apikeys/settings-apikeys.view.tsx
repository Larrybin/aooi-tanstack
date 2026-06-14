import { useEffect, useState } from 'react';
import { SettingsShellView } from '@/surfaces/member/settings-shell/settings-shell.view';

import { isRtlLocale } from '@/config/locale';

import type { SettingsApiKeysRouteData } from './settings-apikeys.types';

export function SettingsApiKeysRouteView({
  data,
}: {
  data: SettingsApiKeysRouteData;
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

  async function copyApiKey(key: string) {
    if (!key || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(key);
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
            <header>
              <h2>{data.page.labels.listTitle}</h2>
              <a href={data.page.createHref}>{data.page.labels.create}</a>
            </header>
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
                    <th>{data.page.labels.title}</th>
                    <th>{data.page.labels.key}</th>
                    <th>{data.page.labels.createdAt}</th>
                    <th>{data.page.labels.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.page.records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.title || '-'}</td>
                      <td>
                        {record.key || '-'}
                        {record.key ? (
                          <button
                            type="button"
                            onClick={() => copyApiKey(record.key)}
                          >
                            {data.page.labels.copyAction}
                          </button>
                        ) : null}
                      </td>
                      <td>{record.createdAt}</td>
                      <td>
                        <a href={record.editHref}>{data.page.labels.edit}</a>
                        <a href={record.deleteHref}>
                          {data.page.labels.delete}
                        </a>
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
