import 'server-only';

import { site } from '@/site';

import { NotFoundError } from '@/shared/lib/api/errors';

export function requireTextToSpeechGeneratorSite(): void {
  if (site.key === 'text-to-speech-generator') {
    return;
  }

  throw new NotFoundError('not found');
}
