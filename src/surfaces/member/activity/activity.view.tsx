import { useEffect, type ReactNode } from 'react';

import { isRtlLocale } from '@/config/locale';

import type { ActivityRouteData } from './activity.types';

export function ActivityRouteView({ data }: { data: ActivityRouteData }) {
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

  return (
    <ActivityShell shell={data.shell}>
      {!data.viewer.signedIn ? (
        <section className="settings-panel">
          <p>{data.page.noAuthMessage}</p>
        </section>
      ) : (
        <section className="settings-panel">
          <header>
            <h2>{data.page.title}</h2>
            {data.page.buttons.map((button) => (
              <a key={button.url} href={button.url} target={button.target}>
                {button.title}
              </a>
            ))}
          </header>
          {data.page.tabs.length > 0 ? (
            <nav aria-label={data.page.title}>
              {data.page.tabs.map((tab) => (
                <a key={tab.url} href={tab.url} aria-current={tab.active}>
                  {tab.title}
                </a>
              ))}
            </nav>
          ) : null}
          {data.page.rows.length === 0 ? (
            <p>{data.page.emptyMessage}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  {data.page.columns.map((column) => (
                    <th key={column.key}>{column.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.page.rows.map((row) => (
                  <tr key={row.id}>
                    {data.page.columns.map((column) => (
                      <td key={column.key}>{renderCell(row, column.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {hasPagination ? (
            <nav className="settings-pagination" aria-label={data.page.title}>
              {data.page.pagination.previousHref ? (
                <a href={data.page.pagination.previousHref}>Previous</a>
              ) : null}
              <span>
                {data.page.pagination.page} / {totalPages}
              </span>
              {data.page.pagination.nextHref ? (
                <a href={data.page.pagination.nextHref}>Next</a>
              ) : null}
            </nav>
          ) : null}
        </section>
      )}
    </ActivityShell>
  );
}

function ActivityShell({
  shell,
  children,
}: {
  shell: ActivityRouteData['shell'];
  children: ReactNode;
}) {
  return (
    <div className="settings-shell">
      <header className="settings-shell-header">
        <h1>{shell.title}</h1>
        <nav className="settings-top-nav" aria-label="Activity top navigation">
          {shell.topNav.items.map((item) => (
            <a key={item.url} href={item.url}>
              {item.title}
            </a>
          ))}
        </nav>
      </header>
      <div className="settings-shell-body">
        <aside className="settings-sidebar">
          <nav aria-label="Activity navigation">
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

function renderCell(
  row: ActivityRouteData['page']['rows'][number],
  key: string
) {
  if (key === 'result') {
    return renderAiTaskResult(row);
  }

  if (key === 'action') {
    return row.actions.length > 0
      ? row.actions.map((action) => (
          <a key={action.url} href={action.url} target={action.target}>
            {action.title}
          </a>
        ))
      : '-';
  }

  return row.values[key] || '-';
}

function renderAiTaskResult(row: ActivityRouteData['page']['rows'][number]) {
  if (!row.result) {
    return '-';
  }

  if (row.result.kind === 'error') {
    return <span data-status="error">Failed: {row.result.message}</span>;
  }

  if (row.result.kind === 'songs') {
    return (
      <div>
        {row.result.songs.map((song) => (
          <audio
            key={song.id}
            controls
            src={song.audioUrl}
            title={song.title}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {row.result.images.map((image) => (
        <img
          key={image.imageUrl}
          src={image.imageUrl}
          alt="Generated image"
          width={128}
          height={128}
        />
      ))}
    </div>
  );
}
