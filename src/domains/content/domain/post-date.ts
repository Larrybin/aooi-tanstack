import 'server-only';

import { formatPostDateForLocale } from '@/shared/lib/post-date-format';

export function formatPostDate(createdAt: string, locale?: string) {
  return formatPostDateForLocale(createdAt, locale);
}
