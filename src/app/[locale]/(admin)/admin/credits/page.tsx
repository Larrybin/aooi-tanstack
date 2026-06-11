// data: admin session (RBAC) + credits ledger (db) + pagination/filter
// cache: no-store (request-bound auth/RBAC)
// reason: billing/credits data is sensitive; avoid caching across users/roles
import {
  listAdminCreditsQuery,
  type AdminCreditRow,
} from '@/domains/account/application/admin-credits.query';
import {
  ACCOUNT_CREDIT_TRANSACTION_TYPE,
  type AccountCreditTransactionType,
} from '@/domains/account/application/use-cases';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminCreditsListQuerySchema,
  type AdminCreditsListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

function toAdminCreditTransactionType(
  value?: string
): AccountCreditTransactionType | undefined {
  if (!value || value === 'all') {
    return undefined;
  }

  if (value === ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT) {
    return ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT;
  }

  if (value === ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME) {
    return ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME;
  }

  return undefined;
}

export default createAdminTablePage<AdminCreditRow, AdminCreditsListQuery>({
  namespace: 'admin.credits',
  permission: PERMISSIONS.CREDITS_READ,
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.credits' },
  ],
  tabs: [
    { name: 'all', titleKey: 'list.tabs.all' },
    {
      name: ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT,
      titleKey: 'list.tabs.grant',
      queryPatch: { type: ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT },
    },
    {
      name: ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME,
      titleKey: 'list.tabs.consume',
      queryPatch: { type: ACCOUNT_CREDIT_TRANSACTION_TYPE.CONSUME },
    },
  ],
  query: {
    schema: AdminCreditsListQuerySchema,
    load: async ({ page, pageSize, type }) =>
      listAdminCreditsQuery({
        page,
        limit: pageSize,
        transactionType: toAdminCreditTransactionType(type),
      }),
  },
  columns: ({ t }) => [
    {
      name: 'transactionNo',
      title: t('fields.transaction_no'),
      type: 'copy',
    },
    { name: 'user', title: t('fields.user'), type: 'user' },
    {
      name: 'credits',
      title: t('fields.amount'),
      callback: (item) => {
        if (item.credits > 0) {
          return <div className="text-green-500">+{item.credits}</div>;
        }

        return <div className="text-red-500">{item.credits}</div>;
      },
    },
    {
      name: 'remainingCredits',
      title: t('fields.remaining'),
      type: 'label',
      placeholder: '-',
    },
    { name: 'transactionType', title: t('fields.type') },
    { name: 'transactionScene', title: t('fields.scene'), placeholder: '-' },
    { name: 'description', title: t('fields.description'), placeholder: '-' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    {
      name: 'expiresAt',
      title: t('fields.expires_at'),
      type: 'time',
      placeholder: '-',
      metadata: { format: 'YYYY-MM-DD HH:mm:ss' },
    },
    {
      name: 'metadata',
      title: t('fields.metadata'),
      type: 'json_preview',
      placeholder: '-',
    },
  ],
});
