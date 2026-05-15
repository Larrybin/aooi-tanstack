import 'server-only';

import { site } from '@/site';

import { NotFoundError } from '@/shared/lib/api/errors';

export function requireRemoverSite(): void {
  const siteKey: string = site.key;
  if (siteKey === 'ai-remover') {
    return;
  }

  throw new NotFoundError('not found');
}
