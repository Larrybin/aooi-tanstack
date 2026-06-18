import { useState } from 'react';
import { submitAdminSettingsRouteData } from '@/server/admin/admin-route-data';
import type { AdminRouteData } from '@/server/admin/admin-route-resolver';

import { FormCard } from '@/shared/blocks/form';
import type { Form as FormType } from '@/shared/types/blocks/form';

type Ok = Extract<AdminRouteData, { status: 'ok' }>;
type SettingsPage = Extract<Ok['page'], { kind: 'settings' }>;
type SettingsForm = SettingsPage['forms'][number];
type SubmitHandler = NonNullable<NonNullable<FormType['submit']>['handler']>;

export function NativeAdminView({ data }: { data: Ok }) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
      <nav className="mt-6 flex flex-wrap gap-2">
        {data.nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {item.title}
          </a>
        ))}
      </nav>
      <section className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
        {data.page.kind === 'overview' ? <p>{data.page.description}</p> : null}
        {data.page.kind === 'settings' ? (
          <SettingsView locale={data.locale} page={data.page} />
        ) : null}
        {data.page.kind === 'users' ? <UsersView page={data.page} /> : null}
        {data.page.kind === 'table' ? <TableView page={data.page} /> : null}
      </section>
    </main>
  );
}

function SettingsView({
  locale,
  page,
}: {
  locale: string;
  page: SettingsPage;
}) {
  const [message, setMessage] = useState<{
    status: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit: SubmitHandler = async (formData) => {
    const result = await submitAdminSettingsRouteData({
      data: { locale, values: formDataToValues(formData) },
    });
    setMessage({ status: result.status, text: result.message });
    return result;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {page.tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className="rounded-md border px-3 py-2 text-sm"
          >
            {tab.title}
          </a>
        ))}
      </div>

      {page.loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Settings could not be loaded: {page.loadError}
        </div>
      ) : null}

      {message ? (
        <p
          className="rounded-md border p-3 text-sm"
          data-status={message.status}
        >
          {message.text}
        </p>
      ) : null}

      {page.moduleContracts.length > 0 ? (
        <div
          className="space-y-3 rounded-lg border p-4"
          data-testid="admin-settings-module-contract"
        >
          {page.moduleContracts.map((moduleContract) => (
            <div
              key={`${moduleContract.relationship}-${moduleContract.moduleId}`}
              className="flex flex-wrap gap-3 rounded-md border p-3 text-sm"
              data-testid="admin-settings-module-contract-row"
              data-module-id={moduleContract.moduleId}
              data-relationship={moduleContract.relationship}
              data-tier={moduleContract.tier}
              data-verification={moduleContract.verification}
            >
              <span>{moduleContract.title}</span>
              <span>{moduleContract.relationship}</span>
              <span>{moduleContract.tier}</span>
              <span>{moduleContract.verification}</span>
              <a href={moduleContract.guideHref}>Guide</a>
            </div>
          ))}
        </div>
      ) : null}

      {page.forms.length > 0 ? (
        page.forms.map((form, index) => (
          <div key={getSettingsFormKey(form, index)}>
            <FormCard
              title={form.title}
              description={form.description}
              form={withSettingsSubmitHandler(form, handleSubmit)}
              className="mb-8 md:max-w-xl"
            />
          </div>
        ))
      ) : (
        <SettingsReadOnlyTable page={page} />
      )}
    </div>
  );
}

function formDataToValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    values[key] = typeof value === 'string' ? value : value.name;
  }
  return values;
}

function getSettingsFormKey(form: SettingsForm, index: number) {
  return (
    form.title ?? form.fields.map((field) => field.name).join('|') ?? index
  );
}

function withSettingsSubmitHandler(
  form: SettingsForm,
  handler: SubmitHandler
): FormType {
  return {
    ...form,
    submit: form.submit ? { ...form.submit, handler } : undefined,
  };
}

function SettingsReadOnlyTable({ page }: { page: SettingsPage }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr>
          <th>Setting</th>
          <th>Group</th>
          <th>Type</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {page.fields.map((field) => (
          <tr key={field.name}>
            <td>{field.title}</td>
            <td>{field.group}</td>
            <td>{field.type}</td>
            <td>{field.value || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UsersView({ page }: { page: Extract<Ok['page'], { kind: 'users' }> }) {
  const columns = Array.from(
    new Set(page.rows.flatMap((row) => Object.keys(row)))
  );
  return (
    <div className="space-y-4">
      <p>Total users: {page.total}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column}>{row[column] || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableView({ page }: { page: Extract<Ok['page'], { kind: 'table' }> }) {
  return (
    <div className="space-y-4">
      <p>Total rows: {page.total}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {page.columns.map((column) => (
              <th key={column.key}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.rows.map((row, index) => (
            <tr key={row.id || row.orderNo || row.code || row.name || index}>
              {page.columns.map((column) => (
                <td key={column.key}>{row[column.key] || '-'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
