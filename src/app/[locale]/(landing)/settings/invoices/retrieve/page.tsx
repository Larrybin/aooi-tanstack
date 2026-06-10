// data: signed-in user (better-auth) + order (db) + provider invoice URL + redirect
// cache: no-store (request-bound auth)
// reason: user-specific invoice retrieval; do not cache redirects
import { notFound, redirect } from 'next/navigation';
import { retrieveMemberInvoiceUrl } from '@/domains/billing/application/member-billing.actions';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';

import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { Empty } from '@/shared/blocks/common/empty';
import { toErrorMessage } from '@/shared/lib/errors';

export default async function RetrieveInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order_no: string }>;
}) {
  if (resolveSitePaymentCapability() === 'none') {
    notFound();
  }

  const { locale: _locale } = await params;
  const { order_no } = await searchParams;

  if (!order_no) {
    return <Empty message="invalid order no" />;
  }

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message="no auth, please sign in" />;
  }

  let result: Awaited<ReturnType<typeof retrieveMemberInvoiceUrl>> | undefined;
  let errorMessage: string | undefined;
  try {
    result = await retrieveMemberInvoiceUrl({
      orderNo: order_no,
      actorUserId: user.id,
    });
  } catch (error: unknown) {
    errorMessage = toErrorMessage(error) || 'get invoice failed';
  }

  if (errorMessage) {
    return <Empty message={errorMessage} />;
  }
  if (!result || result.status === 'missing_invoice_url') {
    return <Empty message="invoice url not found" />;
  }
  if (result.status === 'not_found') {
    return <Empty message="order not found" />;
  }
  if (result.status === 'forbidden') {
    return <Empty message="no permission" />;
  }
  if (result.status === 'missing_invoice') {
    return <Empty message="order with no invoice" />;
  }

  redirect(result.invoiceUrl);
  return <Empty message="invoice url not found" />;
}
