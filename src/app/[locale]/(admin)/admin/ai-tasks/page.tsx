// data: admin session (RBAC) + ai tasks list (db) + pagination/filter
// cache: no-store (request-bound auth/RBAC)
// reason: task logs are sensitive; avoid caching across users/roles
import { notFound } from 'next/navigation';
import {
  listAdminAiTasksQuery,
  type AdminAiTaskRow,
} from '@/domains/ai/application/admin-ai-tasks.query';
import { isAiEnabled } from '@/domains/ai/domain/enablement';
import { readPublicUiConfigCached } from '@/domains/settings/application/settings-runtime.query';
import { createAdminTablePage } from '@/app/_admin-support/create-admin-table-page';
import {
  AdminAiTasksListQuerySchema,
  type AdminAiTasksListQuery,
} from '@/surfaces/admin/schemas/list';

import { AIMediaType } from '@/extensions/ai';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';

export default createAdminTablePage<AdminAiTaskRow, AdminAiTasksListQuery>({
  namespace: 'admin.ai-tasks',
  permission: PERMISSIONS.AITASKS_READ,
  beforeLoad: async () => {
    if (!isAiEnabled(await readPublicUiConfigCached())) {
      notFound();
    }
  },
  crumbs: [
    { key: 'list.crumbs.admin', url: '/admin' },
    { key: 'list.crumbs.ai-tasks' },
  ],
  tabs: [
    { name: 'all', titleKey: 'list.tabs.all' },
    {
      name: AIMediaType.MUSIC,
      titleKey: 'list.tabs.music',
      queryPatch: { type: AIMediaType.MUSIC },
    },
    {
      name: AIMediaType.IMAGE,
      titleKey: 'list.tabs.image',
      queryPatch: { type: AIMediaType.IMAGE },
    },
    {
      name: AIMediaType.VIDEO,
      titleKey: 'list.tabs.video',
      queryPatch: { type: AIMediaType.VIDEO },
    },
    {
      name: AIMediaType.SPEECH,
      titleKey: 'list.tabs.audio',
      queryPatch: { type: AIMediaType.SPEECH },
    },
    {
      name: AIMediaType.TEXT,
      titleKey: 'list.tabs.text',
      queryPatch: { type: AIMediaType.TEXT },
    },
  ],
  query: {
    schema: AdminAiTasksListQuerySchema,
    load: async ({ page, pageSize, type }) =>
      listAdminAiTasksQuery({
        page,
        limit: pageSize,
        mediaType: type,
      }),
  },
  columns: ({ t }) => [
    { name: 'id', title: t('fields.task_id'), type: 'copy' },
    { name: 'createdAt', title: t('fields.created_at'), type: 'time' },
    { name: 'user', title: t('fields.user'), type: 'user' },
    { name: 'status', title: t('fields.status'), type: 'label' },
    { name: 'costCredits', title: t('fields.cost_credits'), type: 'label' },
    { name: 'mediaType', title: t('fields.media_type'), type: 'label' },
    { name: 'scene', title: t('fields.scene'), type: 'label' },
    { name: 'provider', title: t('fields.provider'), type: 'label' },
    { name: 'model', title: t('fields.model'), type: 'label' },
    { name: 'prompt', title: t('fields.prompt'), type: 'copy' },
    { name: 'options', title: t('fields.options'), type: 'json_preview' },
    { name: 'taskResult', title: t('fields.result'), type: 'json_preview' },
  ],
});
