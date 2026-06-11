// data: admin session (RBAC) + chats list (db) + pagination
// cache: no-store (request-bound auth/RBAC)
// reason: chat logs are sensitive; avoid caching across users/roles
import { notFound } from 'next/navigation';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import {
  listAdminChatsQuery,
  type AdminChatRow,
} from '@/domains/chat/application/admin-chats.query';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminChatsListQuerySchema,
  type AdminChatsListQuery,
} from '@/surfaces/admin/schemas/list';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<AdminChatRow, AdminChatsListQuery>({
  namespace: 'admin.chats',
  permission: PERMISSIONS.AITASKS_READ,
  beforeLoad: async () => {
    if (!isAiEnabled(await readPublicUiConfigCached())) {
      notFound();
    }
  },
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.chats' },
  ],
  query: {
    schema: AdminChatsListQuerySchema,
    load: async ({ page, pageSize }) =>
      listAdminChatsQuery({
        page,
        limit: pageSize,
      }),
  },
  columns: ({ t }) => [
    { name: 'title', title: t('fields.title'), type: 'copy' },
    { name: 'user', title: t('fields.user'), type: 'user' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'model', title: t('fields.model'), type: 'label' },
    { name: 'provider', title: t('fields.provider'), type: 'label' },
    {
      name: 'action',
      title: t('fields.action'),
      type: 'dropdown',
      callback: (item) => [
        {
          title: t('list.buttons.view'),
          url: `/chat/${item.id}`,
          target: '_blank',
          icon: 'RiEyeLine',
        },
      ],
    },
  ],
});
