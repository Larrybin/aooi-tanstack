// data: signed-in user (better-auth) + subscription (db) + provider billing portal URL + redirect
// cache: no-store (request-bound auth)
// reason: user-specific provider portal entry; do not cache redirects
import { notFound, redirect } from 'next/navigation';
import { retrieveMemberBillingPortalUrl } from '@/domains/billing/application/member-billing.actions';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { buildCanonicalUrl } from '@/infra/url/canonical';
import { getTranslations } from 'next-intl/server';

import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { Empty } from '@/shared/blocks/common/empty';
import { toErrorMessage } from '@/shared/lib/errors';

export default async function RetrieveBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subscription_no: string }>;
}) {
  if (resolveSitePaymentCapability() === 'none') {
    notFound();
  }

  const { locale: _locale } = await params;
  const { subscription_no } = await searchParams;
  const t = await getTranslations('settings.billing');

  if (!subscription_no) {
    return <Empty message={t('errors.invalid_subscription_no')} />;
  }

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.no_auth')} />;
  }

  let result:
    | Awaited<ReturnType<typeof retrieveMemberBillingPortalUrl>>
    | undefined;
  let errorMessage: string | undefined;
  try {
    result = await retrieveMemberBillingPortalUrl({
      subscriptionNo: subscription_no,
      actorUserId: user.id,
      returnUrl: buildCanonicalUrl('/settings/billing'),
    });
  } catch (error: unknown) {
    errorMessage = toErrorMessage(error) || t('errors.get_billing_failed');
  }

  if (errorMessage) {
    return <Empty message={errorMessage} />;
  }
  if (!result || result.status === 'missing_billing_url') {
    return <Empty message={t('errors.billing_url_not_found')} />;
  }
  if (result.status === 'not_found') {
    return <Empty message={t('errors.subscription_not_found')} />;
  }
  if (result.status === 'forbidden') {
    return <Empty message={t('errors.no_permission')} />;
  }
  if (result.status === 'missing_customer') {
    return <Empty message={t('errors.missing_payment_user_id')} />;
  }

  redirect(result.billingUrl);
  return <Empty message={t('errors.billing_url_not_found')} />;
}
