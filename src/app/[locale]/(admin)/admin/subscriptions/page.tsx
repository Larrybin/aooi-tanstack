// data: admin session (RBAC) + subscriptions list (db) + pagination/filter
// cache: no-store (request-bound auth/RBAC)
// reason: billing data is sensitive; avoid caching across users/roles
import {
  listAdminSubscriptionsQuery,
  type AdminSubscriptionRow,
} from '@/domains/billing/application/member-billing.query';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminSubscriptionsListQuerySchema,
  type AdminSubscriptionsListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<
  AdminSubscriptionRow,
  AdminSubscriptionsListQuery
>({
  namespace: 'admin.subscriptions',
  permission: PERMISSIONS.SUBSCRIPTIONS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.subscriptions' },
  ],
  tabs: [
    { name: 'all', titleKey: 'list.tabs.all' },
    {
      name: 'month',
      titleKey: 'list.tabs.month',
      queryPatch: { interval: 'month' },
    },
    {
      name: 'year',
      titleKey: 'list.tabs.year',
      queryPatch: { interval: 'year' },
    },
  ],
  query: {
    schema: AdminSubscriptionsListQuerySchema,
    load: async ({ page, pageSize, interval }) =>
      listAdminSubscriptionsQuery({
        page,
        limit: pageSize,
        interval,
      }),
  },
  columns: ({ t }) => [
    {
      name: 'subscriptionNo',
      title: t('fields.subscription_no'),
      type: 'copy',
    },
    { name: 'user', title: t('fields.user'), type: 'user' },
    {
      title: t('fields.amount'),
      callback: (item) => {
        if (item.amount == null) {
          return '-';
        }

        return (
          <div className="text-primary">{`${item.amount / 100} ${item.currency}`}</div>
        );
      },
      type: 'copy',
    },
    {
      name: 'interval',
      title: t('fields.interval'),
      type: 'label',
      placeholder: '-',
    },
    {
      name: 'paymentProvider',
      title: t('fields.provider'),
      type: 'label',
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'currentPeriodStart',
      title: t('fields.current_period_start'),
      type: 'time',
      metadata: { format: 'YYYY-MM-DD HH:mm:ss' },
    },
    {
      name: 'currentPeriodEnd',
      title: t('fields.current_period_end'),
      type: 'time',
      metadata: { format: 'YYYY-MM-DD HH:mm:ss' },
    },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'description', title: t('fields.description'), placeholder: '-' },
  ],
});
