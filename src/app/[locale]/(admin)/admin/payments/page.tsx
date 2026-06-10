// data: admin session (RBAC) + payments/orders list (db) + pagination/search/filter
// cache: no-store (request-bound auth/RBAC)
// reason: billing data is sensitive; avoid caching across users/roles
import { notFound } from 'next/navigation';
import {
  ADMIN_PAYMENT_FILTER_STATUSES,
  listAdminPaymentsQuery,
  type AdminPaymentRow,
} from '@/domains/billing/application/member-billing.query';
import { PaymentType } from '@/domains/billing/domain/payment';
import { createAdminTablePage } from '@/surfaces/admin/create-admin-table-page';
import {
  AdminPaymentsListQuerySchema,
  type AdminPaymentsListQuery,
} from '@/surfaces/admin/schemas/list';

import { resolveSitePaymentCapability } from '@/config/payment-capability';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<AdminPaymentRow, AdminPaymentsListQuery>({
  namespace: 'admin.payments',
  permission: PERMISSIONS.PAYMENTS_READ,
  beforeLoad: async () => {
    if (resolveSitePaymentCapability() === 'none') {
      notFound();
    }
  },
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.payments' },
  ],
  tabs: [
    { name: 'all', titleKey: 'list.tabs.all' },
    {
      name: 'subscription',
      titleKey: 'list.tabs.subscription',
      queryPatch: { type: PaymentType.SUBSCRIPTION },
    },
    {
      name: 'one-time',
      titleKey: 'list.tabs.one-time',
      queryPatch: { type: PaymentType.ONE_TIME },
    },
  ],
  filters: [
    {
      name: 'status',
      titleKey: 'list.filters.status.title',
      options: [
        { value: 'all', labelKey: 'list.filters.status.options.all' },
        {
          value: ADMIN_PAYMENT_FILTER_STATUSES[0],
          labelKey: 'list.filters.status.options.paid',
        },
        {
          value: ADMIN_PAYMENT_FILTER_STATUSES[1],
          labelKey: 'list.filters.status.options.created',
        },
        {
          value: ADMIN_PAYMENT_FILTER_STATUSES[2],
          labelKey: 'list.filters.status.options.failed',
        },
      ],
    },
    {
      name: 'provider',
      titleKey: 'list.filters.provider.title',
      options: [
        { value: 'all', labelKey: 'list.filters.provider.options.all' },
        {
          value: resolveSitePaymentCapability(),
          labelKey: `list.filters.provider.options.${resolveSitePaymentCapability()}`,
        },
      ],
    },
  ],
  search: {
    name: 'orderNo',
    titleKey: 'list.search.order_no.title',
    placeholderKey: 'list.search.order_no.placeholder',
  },
  actions: [
    {
      title: 'Webhook Replay',
      url: '/admin/payments/replay',
      variant: 'outline',
    },
  ],
  query: {
    schema: AdminPaymentsListQuerySchema,
    load: async ({ page, pageSize, orderNo, provider, status, type }) =>
      listAdminPaymentsQuery({
        page,
        limit: pageSize,
        orderNo,
        paymentType: type as PaymentType | undefined,
        paymentProvider: provider,
        status: status as AdminPaymentRow['status'],
      }),
  },
  columns: ({ t }) => [
    { name: 'orderNo', title: t('fields.order_no'), type: 'copy' },
    { name: 'user', title: t('fields.user'), type: 'user' },
    {
      title: t('fields.amount'),
      callback: (item) => (
        <div className="text-primary">{`${item.amount / 100} ${item.currency}`}</div>
      ),
      type: 'copy',
    },
    { name: 'status', title: t('fields.status'), type: 'label' },
    {
      name: 'paymentType',
      title: t('fields.type'),
      type: 'label',
      placeholder: '-',
    },
    {
      name: 'productId',
      title: t('fields.product'),
      type: 'label',
      placeholder: '-',
    },
    { name: 'description', title: t('fields.description'), placeholder: '-' },
    {
      name: 'paymentProvider',
      title: t('fields.provider'),
      type: 'label',
    },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
  ],
});
