import { createApiContext } from '@/app/api/_lib/context';
import { resolveTextToSpeechDownload } from '@/domains/text-to-speech-generator/application/download';
import { findTextToSpeechGenerationById } from '@/domains/text-to-speech-generator/infra/generation';
import { getStorageService } from '@/infra/adapters/storage/service';
import type { StorageStoredFile } from '@/infra/adapters/storage/service-builder';

import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';

import { requireTextToSpeechGeneratorSite } from '../../_lib/guard';
import { resolveTextToSpeechActor } from '../../actor.server';

type AvailableStorageFile = StorageStoredFile & {
  body: ReadableStream<Uint8Array>;
};

function contentDisposition(filename: string): string {
  const safeFilename = filename.replace(/["\r\n]/gu, '_');
  return `attachment; filename="${safeFilename}"`;
}

async function readAudioFile(
  storageKey: string
): Promise<AvailableStorageFile> {
  const storage = await getStorageService();
  const file = await storage.getFile(storageKey);
  if (!file?.body) {
    throw new NotFoundError('text to speech audio not found');
  }

  return { ...file, body: file.body };
}

export const GET = withApi(
  async (req: Request, context: { params: Promise<{ id?: string }> }) => {
    requireTextToSpeechGeneratorSite();
    const api = createApiContext(req);
    const { id } = await context.params;
    const generationId = id?.trim();
    if (!generationId) {
      throw new BadRequestError('generation id is required');
    }

    const actor = await resolveTextToSpeechActor(req);
    const download = await resolveTextToSpeechDownload({
      actor,
      generationId,
      deps: {
        findGenerationById: findTextToSpeechGenerationById,
      },
    });
    const file = await readAudioFile(download.storageKey);
    api.log.debug('tts: download resolved', {
      generationId,
      contentLength: file.contentLength,
    });

    return new Response(file.body, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': file.contentType,
        'Content-Disposition': contentDisposition(download.filename),
        ...(file.contentLength
          ? { 'Content-Length': String(file.contentLength) }
          : {}),
      },
    });
  }
);
