import 'server-only';

import { site } from '@/site';

import { NotFoundError } from '@/shared/lib/api/errors';

export function requireTextToSpeechGeneratorSite(): void {
  const siteKey: string = site.key;
  if (siteKey === 'text-to-speech-generator') {
    return;
  }

  throw new NotFoundError('not found');
}
