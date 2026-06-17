import type { AdminRouteData } from '@/server/admin/admin-route-resolver';

type Ok = Extract<AdminRouteData, { status: 'ok' }>;

export function NativeAdminView({ data }: { data: Ok }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
      <nav className="mt-6 flex flex-wrap gap-2">
        {data.nav.map((item) => (
          <a key={item.href} href={item.href} className="rounded-md border px-3 py-2 text-sm">
            {item.title}
          </a>
        ))}
      </nav>
      <section className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
        {data.page.kind === 'overview' ? <p>{data.page.description}</p> : null}
        {data.page.kind === 'settings' ? <SettingsView page={data.page} /> : null}
        {data.page.kind === 'users' ? <UsersView page={data.page} /> : null}
      </section>
    </main>
  );
}

function SettingsView({ page }: { page: Extract<Ok['page'], { kind: 'settings' }> }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {page.tabs.map((tab) => (
          <a key={tab.href} href={tab.href} className="rounded-md border px-3 py-2 text-sm">
            {tab.title}
          </a>
        ))}
      </div>
      <table className="w-full text-left text-sm">
        <thead><tr><th>Setting</th><th>Group</th><th>Type</th><th>Value</th></tr></thead>
        <tbody>{page.fields.map((field) => <tr key={field.name}><td>{field.title}</td><td>{field.group}</td><td>{field.type}</td><td>{field.value || '-'}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function UsersView({ page }: { page: Extract<Ok['page'], { kind: 'users' }> }) {
  const columns = Array.from(new Set(page.rows.flatMap((row) => Object.keys(row))));
  return (
    <div className="space-y-4">
      <p>Total users: {page.total}</p>
      <table className="w-full text-left text-sm">
        <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{page.rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column}>{row[column] || '-'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
