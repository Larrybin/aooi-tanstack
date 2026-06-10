// data: admin session (RBAC) + payment webhook inbox preview + server action execute
// cache: no-store (request-bound auth/RBAC)
import { notFound, redirect } from 'next/navigation';
import { requirePagePermission } from '@/app/[locale]/(admin)/_guards/page-access';
import {
  buildPaymentReplayReturnPath,
  getPaymentReplayPreviewLabel,
  listAdminPaymentReplayPreview,
  parsePaymentReplayDateTime,
  PAYMENT_WEBHOOK_INBOX_STATUS,
  PAYMENT_WEBHOOK_OPERATION_KIND,
} from '@/domains/billing/application/admin-payment-replay';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { Header, Main, MainHeader } from '@/shared/blocks/workspace';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { Crumb } from '@/shared/types/blocks/common';

import { executePaymentWebhookReplayAction } from './actions';

export default async function PaymentReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (resolveSitePaymentCapability() === 'none') {
    notFound();
  }

  const { locale } = await params;
  setRequestLocale(locale);

  await requirePagePermission({
    code: PERMISSIONS.PAYMENTS_WRITE,
    redirectUrl: '/admin/no-permission',
    locale,
  });

  const t = await getTranslations('admin.payments');
  const query = await searchParams;

  const provider = query.provider?.trim() || '';
  const eventId = query.eventId?.trim() || '';
  const status = query.status?.trim() || 'all';
  const receivedFrom = query.receivedFrom?.trim() || '';
  const receivedTo = query.receivedTo?.trim() || '';
  const operationKind =
    query.operationKind === PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION
      ? PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION
      : PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY;
  const previewEnabled = query.preview === '1';

  const rows = previewEnabled
    ? await listAdminPaymentReplayPreview({
        provider: provider || undefined,
        eventId: eventId || undefined,
        status:
          status === 'all'
            ? 'all'
            : (status as (typeof PAYMENT_WEBHOOK_INBOX_STATUS)[keyof typeof PAYMENT_WEBHOOK_INBOX_STATUS]),
        receivedFrom: parsePaymentReplayDateTime(receivedFrom),
        receivedTo: parsePaymentReplayDateTime(receivedTo),
      })
    : [];

  const executableRows = rows.filter((row) => Boolean(row.canonicalEvent));
  const returnPath = buildPaymentReplayReturnPath({
    preview: '1',
    provider,
    eventId,
    status,
    receivedFrom,
    receivedTo,
    operationKind,
  });

  const crumbs: Crumb[] = [
    { title: t('list.crumbs.admin'), url: '/admin' },
    { title: t('list.crumbs.payments'), url: '/admin/payments' },
    { title: 'Webhook Replay', is_active: true },
  ];

  async function submitPaymentWebhookReplayAction(formData: FormData) {
    'use server';

    const result = await executePaymentWebhookReplayAction(formData);
    const fallbackReturnPath = String(
      formData.get('returnPath') || '/admin/payments/replay?preview=1'
    );
    const separator = fallbackReturnPath.includes('?') ? '&' : '?';
    redirect(
      result.redirect_url ||
        `${fallbackReturnPath}${separator}execute_error=1&message=${encodeURIComponent(result.message)}`
    );
  }

  return (
    <>
      <Header crumbs={crumbs} />
      <Main>
        <MainHeader
          title="Webhook Replay"
          description="Preview inbox records, then execute replay or compensation using stored canonical events."
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Preview Filters</CardTitle>
            <CardDescription>
              Filter payment webhook inbox rows by provider, event id, status,
              and received time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" method="get">
              <input type="hidden" name="preview" value="1" />
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <Input
                  name="provider"
                  defaultValue={provider}
                  placeholder="stripe / paypal / creem"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Event ID</label>
                <Input
                  name="eventId"
                  defaultValue={eventId}
                  placeholder="evt_xxx"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <select
                  name="status"
                  defaultValue={status}
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="all">all</option>
                  <option value={PAYMENT_WEBHOOK_INBOX_STATUS.RECEIVED}>
                    received
                  </option>
                  <option value={PAYMENT_WEBHOOK_INBOX_STATUS.PROCESSED}>
                    processed
                  </option>
                  <option value={PAYMENT_WEBHOOK_INBOX_STATUS.IGNORED_UNKNOWN}>
                    ignored_unknown
                  </option>
                  <option value={PAYMENT_WEBHOOK_INBOX_STATUS.PARSE_FAILED}>
                    parse_failed
                  </option>
                  <option value={PAYMENT_WEBHOOK_INBOX_STATUS.PROCESS_FAILED}>
                    process_failed
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Operation</label>
                <select
                  name="operationKind"
                  defaultValue={operationKind}
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value={PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY}>
                    replay
                  </option>
                  <option value={PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION}>
                    compensation
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Received From</label>
                <Input
                  name="receivedFrom"
                  type="datetime-local"
                  defaultValue={receivedFrom}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Received To</label>
                <Input
                  name="receivedTo"
                  type="datetime-local"
                  defaultValue={receivedTo}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">Preview</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {query.executed === '1' ? (
          <Card className="mb-6">
            <CardContent className="pt-6 text-sm">
              <p>
                Executed. processed={query.processed || '0'}, failed=
                {query.failed || '0'}, skipped={query.skipped || '0'}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {query.execute_error === '1' ? (
          <Card className="mb-6 border-red-200">
            <CardContent className="pt-6 text-sm text-red-600">
              <p>Execute failed: {query.message || 'unknown error'}</p>
            </CardContent>
          </Card>
        ) : null}

        {previewEnabled ? (
          <Card>
            <CardHeader>
              <CardTitle>Preview Result</CardTitle>
              <CardDescription>
                {rows.length} rows matched. {executableRows.length} rows have
                canonical events and can be executed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No inbox rows matched the current filter.
                  </p>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{row.provider}</Badge>
                        <Badge variant="secondary">{row.status}</Badge>
                        <Badge variant="outline">
                          {getPaymentReplayPreviewLabel(row)}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>Inbox ID: {row.id}</p>
                        <p>Event ID: {row.eventId || '-'}</p>
                        <p>Event Type: {row.eventType || '-'}</p>
                        <p>Received At: {row.receivedAt.toISOString()}</p>
                        <p>Attempts: {row.processingAttemptCount}</p>
                        <p>Last Error: {row.lastError || '-'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            {executableRows.length > 0 ? (
              <CardFooter className="flex-col items-stretch gap-4">
                <form
                  action={submitPaymentWebhookReplayAction}
                  className="space-y-4"
                >
                  <input
                    type="hidden"
                    name="inboxIds"
                    value={JSON.stringify(executableRows.map((row) => row.id))}
                  />
                  <input
                    type="hidden"
                    name="operationKind"
                    value={operationKind}
                  />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Operator Note</label>
                    <Textarea
                      name="note"
                      placeholder="Describe why you are replaying these webhook rows."
                    />
                  </div>
                  <Button type="submit">
                    Execute {operationKind} for {executableRows.length} row(s)
                  </Button>
                </form>
              </CardFooter>
            ) : null}
          </Card>
        ) : null}
      </Main>
    </>
  );
}
