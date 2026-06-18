import { useState, type FormEvent } from 'react';
import {
  submitAdminActionRouteData,
  submitAdminSettingsRouteData,
} from '@/server/admin/admin-route-data';
import type { AdminRouteData } from '@/server/admin/admin-route-resolver';

import { FormCard } from '@/shared/blocks/form';
import type { Form as FormType } from '@/shared/types/blocks/form';

type Ok = Extract<AdminRouteData, { status: 'ok' }>;
type SettingsPage = Extract<Ok['page'], { kind: 'settings' }>;
type SettingsForm = SettingsPage['forms'][number];
type ActionFormPage = Extract<Ok['page'], { kind: 'form' }>;
type PaymentReplayPage = Extract<Ok['page'], { kind: 'payment_replay' }>;
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
        {data.page.kind === 'form' ? (
          <AdminFormView locale={data.locale} page={data.page} />
        ) : null}
        {data.page.kind === 'payment_replay' ? (
          <PaymentReplayView locale={data.locale} page={data.page} />
        ) : null}
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

function AdminFormView({
  locale,
  page,
}: {
  locale: string;
  page: ActionFormPage;
}) {
  const [message, setMessage] = useState<{
    status: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit: SubmitHandler = async (formData) => {
    const passby =
      page.form.passby &&
      typeof page.form.passby === 'object' &&
      !Array.isArray(page.form.passby)
        ? (page.form.passby as Record<string, unknown>)
        : {};
    const result = await submitAdminActionRouteData({
      data: {
        locale,
        action: page.form.submit?.action ?? '',
        id: typeof passby.id === 'string' ? passby.id : undefined,
        values: formDataToValues(formData),
      },
    });
    setMessage({ status: result.status, text: result.message });
    return result;
  };

  return (
    <div className="space-y-6">
      <a href={page.backHref} className="text-sm underline">
        Back
      </a>
      {message ? (
        <p
          className="rounded-md border p-3 text-sm"
          data-status={message.status}
        >
          {message.text}
        </p>
      ) : null}
      <FormCard
        title={page.form.title}
        description={page.form.description}
        form={withActionSubmitHandler(page.form, handleSubmit)}
        className="mb-8 md:max-w-xl"
      />
    </div>
  );
}

function withActionSubmitHandler(
  form: ActionFormPage['form'],
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
                <td key={column}>{renderAdminCell(row[column])}</td>
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
      <TableActions actions={page.actions} />
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
                <td key={column.key}>{renderAdminCell(row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableActions({
  actions,
}: {
  actions?: Array<{ title: string; href: string }>;
}) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <a
          key={action.href}
          href={action.href}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {action.title}
        </a>
      ))}
    </div>
  );
}

function renderAdminCell(value: string | undefined) {
  if (!value) return '-';
  if (value.startsWith('/')) {
    return (
      <a href={value} className="text-sm underline">
        {adminLinkLabel(value)}
      </a>
    );
  }
  return value;
}

function adminLinkLabel(value: string) {
  if (value.endsWith('/edit-roles')) return 'Edit roles';
  if (value.endsWith('/edit-permissions')) return 'Permissions';
  if (value.endsWith('/delete')) return 'Delete';
  if (value.endsWith('/restore')) return 'Restore';
  if (value.endsWith('/add')) return 'Add';
  if (value.endsWith('/replay')) return 'Replay';
  if (value.endsWith('/edit')) return 'Edit';
  return 'Open';
}

function PaymentReplayView({
  locale,
  page,
}: {
  locale: string;
  page: PaymentReplayPage;
}) {
  const [message, setMessage] = useState<{
    status: 'success' | 'error';
    text: string;
  } | null>(null);

  async function handleExecute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await submitAdminActionRouteData({
      data: {
        locale,
        action: 'payments.replay.execute',
        values: formDataToValues(new FormData(event.currentTarget)),
      },
    });
    setMessage({ status: result.status, text: result.message });
    if (result.redirect_url) {
      window.location.href = result.redirect_url;
    }
  }

  return (
    <div className="space-y-6">
      <form className="grid gap-4 md:grid-cols-2" method="get">
        <input type="hidden" name="preview" value="1" />
        <AdminInput
          name="provider"
          title="Provider"
          value={page.filters.provider}
        />
        <AdminInput
          name="eventId"
          title="Event ID"
          value={page.filters.eventId}
        />
        <label className="space-y-2 text-sm font-medium">
          Status
          <select
            name="status"
            defaultValue={page.filters.status}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="all">all</option>
            <option value="received">received</option>
            <option value="processed">processed</option>
            <option value="ignored_unknown">ignored_unknown</option>
            <option value="parse_failed">parse_failed</option>
            <option value="process_failed">process_failed</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          Operation
          <select
            name="operationKind"
            defaultValue={page.filters.operationKind}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="replay">replay</option>
            <option value="compensation">compensation</option>
          </select>
        </label>
        <AdminInput
          name="receivedFrom"
          title="Received From"
          value={page.filters.receivedFrom}
          type="datetime-local"
        />
        <AdminInput
          name="receivedTo"
          title="Received To"
          value={page.filters.receivedTo}
          type="datetime-local"
        />
        <div className="md:col-span-2">
          <button type="submit" className="rounded-md border px-3 py-2 text-sm">
            Preview
          </button>
        </div>
      </form>

      {page.executedMessage ? <p>{page.executedMessage}</p> : null}
      {page.errorMessage ? (
        <p className="text-sm text-red-600">{page.errorMessage}</p>
      ) : null}
      {message ? <p data-status={message.status}>{message.text}</p> : null}

      {page.previewEnabled ? (
        <div className="space-y-4">
          <p>
            {page.rows.length} rows matched. {page.executableIds.length} rows
            can be executed.
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Inbox ID</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Label</th>
                <th>Event ID</th>
                <th>Received</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {page.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.provider}</td>
                  <td>{row.status}</td>
                  <td>{row.label}</td>
                  <td>{row.eventId || '-'}</td>
                  <td>{row.receivedAt}</td>
                  <td>{row.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {page.executableIds.length > 0 ? (
            <form className="space-y-4" onSubmit={handleExecute}>
              <input
                type="hidden"
                name="inboxIds"
                value={JSON.stringify(page.executableIds)}
              />
              <input
                type="hidden"
                name="operationKind"
                value={page.filters.operationKind}
              />
              <input type="hidden" name="returnPath" value={page.returnPath} />
              <label className="block space-y-2 text-sm font-medium">
                Operator Note
                <textarea
                  name="note"
                  className="min-h-24 w-full rounded-md border px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border px-3 py-2 text-sm"
              >
                Execute {page.filters.operationKind} for{' '}
                {page.executableIds.length} row(s)
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AdminInput({
  name,
  title,
  value,
  type = 'text',
}: {
  name: string;
  title: string;
  value: string;
  type?: string;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      {title}
      <input
        name={name}
        type={type}
        defaultValue={value}
        className="w-full rounded-md border px-3 py-2 text-sm"
      />
    </label>
  );
}
