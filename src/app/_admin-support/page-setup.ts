import 'server-only';

import { requirePagePermission } from '@/app/[locale]/(admin)/_guards/page-access';
import type { PermissionCode } from '@/app/access-control/action-guard';
import { setRequestLocale } from 'next-intl/server';

export async function setupAdminPage({
  locale,
  permission,
  redirectUrl = '/admin/no-permission',
}: {
  locale: string;
  permission: PermissionCode;
  redirectUrl?: string;
}) {
  setRequestLocale(locale);
  await requirePagePermission({ code: permission, redirectUrl, locale });
}
