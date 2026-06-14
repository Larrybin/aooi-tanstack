import { site } from '@/site';

import { NotFoundError } from '@/shared/lib/api/errors';

export function requireBackgroundRemoverSite(): void {
  const siteKey: string = site.key;

  if (siteKey === 'background-remover') {
    return;
  }

  throw new NotFoundError('not found');
}
