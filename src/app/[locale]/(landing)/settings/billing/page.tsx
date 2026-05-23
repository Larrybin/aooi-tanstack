// data: signed-in user (better-auth) + subscriptions (db) + payment callback state (query)
// cache: no-store (request-bound auth)
// reason: user-specific billing history and actions
import { notFound } from 'next/navigation';
import {
  MEMBER_BILLING_ACTIVE_STATUSES,
  readMemberBillingOverviewQuery,
  type MemberSubscriptionRow,
} from '@/domains/billing/application/member-billing.query';
import { formatPaymentAmountCents } from '@/domains/billing/ui/format-money';
import { PaymentCallbackHandler } from '@/domains/billing/ui/payment-callback';
import { getSignedInUserIdentity } from '@/infra/platform/auth/session.server';
import { getTranslations } from 'next-intl/server';

import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { Empty } from '@/shared/blocks/common/empty';
import { PanelCard } from '@/shared/blocks/panel';
import { TableCard } from '@/shared/blocks/table';
import { formatYmd } from '@/shared/lib/date/format-ymd';
import type { Button as ButtonType, Tab } from '@/shared/types/blocks/common';
import { type Table } from '@/shared/types/blocks/table';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: number;
    pageSize?: number;
    status?: string;
    order_no?: string;
  }>;
}) {
  if (resolveSitePaymentCapability() === 'none') {
    notFound();
  }

  const {
    page: pageNum,
    pageSize,
    status,
    order_no: orderNo,
  } = await searchParams;
  const page = pageNum || 1;
  const limit = pageSize || 20;

  const cleanQuery = new URLSearchParams();
  if (pageNum) cleanQuery.set('page', String(pageNum));
  if (pageSize) cleanQuery.set('pageSize', String(pageSize));
  if (status) cleanQuery.set('status', String(status));
  const cleanUrl = cleanQuery.toString()
    ? `/settings/billing?${cleanQuery.toString()}`
    : '/settings/billing';

  const t = await getTranslations('settings.billing');

  const user = await getSignedInUserIdentity();
  if (!user) {
    return <Empty message={t('errors.no_auth')} />;
  }

  const { currentSubscription, subscriptions, total } =
    await readMemberBillingOverviewQuery({
      userId: user.id,
      status,
      page,
      limit,
    });

  const table: Table<MemberSubscriptionRow> = {
    title: t('list.title'),
    columns: [
      {
        name: 'subscriptionNo',
        title: t('fields.subscription_no'),
        type: 'copy',
      },
      {
        name: 'interval',
        title: t('fields.interval'),
        callback: function (item) {
          if (!item.interval || !item.intervalCount) {
            return '-';
          }
          return <div>{`${item.intervalCount}-${item.interval}`}</div>;
        },
      },
      {
        name: 'status',
        title: t('fields.status'),
        type: 'label',
        metadata: { variant: 'outline' },
      },
      {
        title: t('fields.amount'),
        callback: function (item: MemberSubscriptionRow) {
          return (
            <div className="text-primary">
              {formatPaymentAmountCents(item.amount, item.currency)}
            </div>
          );
        },
      },
      {
        name: 'createdAt',
        title: t('fields.created_at'),
        type: 'time',
      },
      {
        title: t('fields.current_period'),
        callback: function (item) {
          const period = (
            <div>
              {`${formatYmd(item.currentPeriodStart)} ~`}
              <br />
              {formatYmd(item.currentPeriodEnd)}
            </div>
          );

          return period;
        },
      },
      {
        title: t('fields.end_time'),
        callback: function (item) {
          if (item.canceledEndAt) {
            return <div>{formatYmd(item.canceledEndAt)}</div>;
          }
          return '-';
        },
      },
      {
        title: t('fields.action'),
        type: 'dropdown',
        callback: function (item) {
          if (!MEMBER_BILLING_ACTIVE_STATUSES.includes(item.status as never)) {
            return null;
          }

          return [
            {
              title: t('view.buttons.cancel'),
              url: `/settings/billing/cancel?subscription_no=${item.subscriptionNo}`,
              icon: 'Ban',
              size: 'sm',
              variant: 'outline',
            },
          ];
        },
      },
    ],
    data: subscriptions,
    pagination: {
      total,
      page,
      limit,
    },
  };

  const tabs: Tab[] = [
    {
      title: t('list.tabs.all'),
      name: 'all',
      url: '/settings/billing',
      is_active: !status || status === 'all',
    },
    {
      title: t('list.tabs.active'),
      name: 'active',
      url: '/settings/billing?status=active',
      is_active: status === 'active',
    },
    {
      title: t('list.tabs.trialing'),
      name: 'trialing',
      url: '/settings/billing?status=trialing',
      is_active: status === 'trialing',
    },
    {
      title: t('list.tabs.paused'),
      name: 'paused',
      url: '/settings/billing?status=paused',
      is_active: status === 'paused',
    },
    {
      title: t('list.tabs.expired'),
      name: 'expired',
      url: '/settings/billing?status=expired',
      is_active: status === 'expired',
    },
    {
      title: t('list.tabs.pending_cancel'),
      name: 'pending_cancel',
      url: '/settings/billing?status=pending_cancel',
      is_active: status === 'pending_cancel',
    },
    {
      title: t('list.tabs.canceled'),
      name: 'canceled',
      url: '/settings/billing?status=canceled',
      is_active: status === 'canceled',
    },
  ];

  let buttons: ButtonType[] = [];
  if (currentSubscription) {
    buttons = [
      {
        title: t('view.buttons.adjust'),
        url: '/pricing',
        target: '_blank',
        icon: 'Pencil',
        size: 'sm',
      },
    ];
    if (currentSubscription.paymentUserId) {
      buttons.push({
        title: t('view.buttons.manage'),
        url: `/settings/billing/retrieve?subscription_no=${currentSubscription.subscriptionNo}`,
        target: '_blank',
        icon: 'Settings',
        size: 'sm',
        variant: 'outline',
      });
    }
  } else {
    buttons = [
      {
        title: t('view.buttons.subscribe'),
        url: '/pricing',
        target: '_blank',
        icon: 'ArrowUpRight',
        size: 'sm',
      },
    ];
  }

  return (
    <div className="space-y-8">
      <PaymentCallbackHandler orderNo={orderNo} cleanUrl={cleanUrl} />
      <PanelCard
        label={currentSubscription?.status}
        title={t('view.title')}
        buttons={buttons}
        className="max-w-md"
      >
        <div className="text-primary text-3xl font-bold">
          {currentSubscription?.planName || t('view.no_subscription')}
        </div>
        {currentSubscription ? (
          <>
            {MEMBER_BILLING_ACTIVE_STATUSES.includes(
              currentSubscription?.status as never
            ) ? (
              <div className="text-muted-foreground mt-4 text-sm font-normal">
                {t('view.tip', {
                  date: formatYmd(currentSubscription?.currentPeriodEnd ?? ''),
                })}
              </div>
            ) : (
              <div className="text-destructive mt-4 text-sm font-normal">
                {t('view.end_tip', {
                  date: formatYmd(currentSubscription?.canceledEndAt ?? ''),
                })}
              </div>
            )}
          </>
        ) : null}
      </PanelCard>
      <TableCard title={t('list.title')} tabs={tabs} table={table} />
    </div>
  );
}
