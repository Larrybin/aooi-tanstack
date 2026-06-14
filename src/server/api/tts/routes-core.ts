import { resolveTextToSpeechDownload } from '@/domains/text-to-speech-generator/application/download';
import type { TextToSpeechProvider } from '@/domains/text-to-speech-generator/application/generate-preview';
import { listTextToSpeechHistory } from '@/domains/text-to-speech-generator/application/history';
import { resolveTextToSpeechQuotaSummary } from '@/domains/text-to-speech-generator/application/quota';
import type { TextToSpeechGenerationRecord } from '@/domains/text-to-speech-generator/domain/history';
import type { TextToSpeechActor } from '@/domains/text-to-speech-generator/domain/types';
import type { StorageService } from '@/infra/adapters/storage/service-builder';

import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';

import type { TextToSpeechApiContext } from './context';
import {
  createTextToSpeechGeneratePostAction,
  type TextToSpeechGenerateActionDeps,
} from './generate-action';

type SetCookieSink = {
  appendSetCookie(value: string): void;
};

type AvailableStorageFile = Awaited<ReturnType<StorageService['getFile']>> & {
  body: ReadableStream<Uint8Array>;
};

export type TextToSpeechRoutesDeps = {
  requireSite: () => void;
  createApiContext: (req: Request) => TextToSpeechApiContext;
  resolveActor: (
    req: Request,
    sink?: SetCookieSink
  ) => Promise<TextToSpeechActor>;
  listGenerations: (input: {
    userId: string | null;
    anonymousSessionId: string | null;
    limit: number;
  }) => Promise<TextToSpeechGenerationRecord[]>;
  countMonthlyQuotaUnits: (input: {
    userId: string;
    windowStart: Date;
    now: Date;
  }) => Promise<number>;
  getRemainingCredits: (userId: string) => Promise<number>;
  findGenerationById: (
    id: string
  ) => Promise<TextToSpeechGenerationRecord | undefined>;
  provider: TextToSpeechProvider;
  getStorageService: TextToSpeechGenerateActionDeps['getStorageService'];
  findReusableGeneration: TextToSpeechGenerateActionDeps['findReusableGeneration'];
  createGeneration: TextToSpeechGenerateActionDeps['createGeneration'];
  markGenerationDeleted: TextToSpeechGenerateActionDeps['markGenerationDeleted'];
  deleteOverflowGenerations: TextToSpeechGenerateActionDeps['deleteOverflowGenerations'];
  reserveMonthlyQuota: TextToSpeechGenerateActionDeps['reserveMonthlyQuota'];
  commitMonthlyQuota: TextToSpeechGenerateActionDeps['commitMonthlyQuota'];
  refundMonthlyQuota: TextToSpeechGenerateActionDeps['refundMonthlyQuota'];
  consumeCredits: TextToSpeechGenerateActionDeps['consumeCredits'];
  refundConsumedCredit: TextToSpeechGenerateActionDeps['refundConsumedCredit'];
  verifyTurnstile?: TextToSpeechGenerateActionDeps['verifyTurnstile'];
  acquireGuestIpLimit?: TextToSpeechGenerateActionDeps['acquireGuestIpLimit'];
};

type PendingResponseHeaders = {
  appendSetCookie(value: string): void;
  apply(response: Response): Response;
};

function createPendingResponseHeaders(): PendingResponseHeaders {
  const setCookies: string[] = [];

  return {
    appendSetCookie(value) {
      setCookies.push(value);
    },
    apply(response) {
      if (!setCookies.length) {
        return response;
      }

      const headers = new Headers(response.headers);
      for (const setCookie of setCookies) {
        headers.append('set-cookie', setCookie);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
  };
}

function createTextToSpeechRequestDeps(deps: TextToSpeechRoutesDeps) {
  const responseHeaders = createPendingResponseHeaders();

  return {
    responseHeaders,
    resolveActor: (req: Request) => deps.resolveActor(req, responseHeaders),
  };
}

function withTextToSpeechApi(
  deps: TextToSpeechRoutesDeps,
  handler: (req: Request, context?: unknown) => Promise<Response> | Response
) {
  return withApi((req: Request, context?: unknown) => {
    deps.requireSite();
    return handler(req, context);
  });
}

async function readRouteId(context: unknown): Promise<string> {
  const routeParams =
    typeof context === 'object' && context && 'params' in context
      ? await Promise.resolve((context as { params: unknown }).params)
      : {};
  const id =
    typeof routeParams === 'object' &&
    routeParams &&
    'id' in routeParams &&
    typeof (routeParams as { id: unknown }).id === 'string'
      ? (routeParams as { id: string }).id.trim()
      : '';
  if (!id) {
    throw new BadRequestError('generation id is required');
  }
  return id;
}

function contentDisposition(filename: string): string {
  const safeFilename = filename.replace(/["\r\n]/gu, '_');
  return `attachment; filename="${safeFilename}"`;
}

async function readAudioFile(
  deps: TextToSpeechRoutesDeps,
  storageKey: string
): Promise<AvailableStorageFile> {
  const storage = await deps.getStorageService();
  const file = await storage.getFile(storageKey);
  if (!file?.body) {
    throw new NotFoundError('text to speech audio not found');
  }

  return { ...file, body: file.body };
}

function createGetTextToSpeechHistory(deps: TextToSpeechRoutesDeps) {
  return withTextToSpeechApi(deps, async (req) => {
    const { responseHeaders, resolveActor } =
      createTextToSpeechRequestDeps(deps);
    const actor = await resolveActor(req);
    const history = await listTextToSpeechHistory({
      actor,
      deps: {
        listGenerations: deps.listGenerations,
      },
    });

    return responseHeaders.apply(
      jsonOk({ items: history }, { headers: { 'Cache-Control': 'no-store' } })
    );
  });
}

function createGetTextToSpeechQuota(deps: TextToSpeechRoutesDeps) {
  return withTextToSpeechApi(deps, async (req) => {
    const { responseHeaders, resolveActor } =
      createTextToSpeechRequestDeps(deps);
    const actor = await resolveActor(req);
    const quota = await resolveTextToSpeechQuotaSummary({
      actor,
      deps: {
        countMonthlyQuotaUnits: deps.countMonthlyQuotaUnits,
        getRemainingCredits: deps.getRemainingCredits,
      },
    });

    return responseHeaders.apply(
      jsonOk(quota, { headers: { 'Cache-Control': 'no-store' } })
    );
  });
}

function createPostTextToSpeechGenerate(deps: TextToSpeechRoutesDeps) {
  return withTextToSpeechApi(deps, async (req) => {
    const { responseHeaders, resolveActor } =
      createTextToSpeechRequestDeps(deps);
    const postAction = createTextToSpeechGeneratePostAction({
      createApiContext: deps.createApiContext,
      resolveActor,
      provider: deps.provider,
      getStorageService: deps.getStorageService,
      findReusableGeneration: deps.findReusableGeneration,
      createGeneration: deps.createGeneration,
      markGenerationDeleted: deps.markGenerationDeleted,
      deleteOverflowGenerations: deps.deleteOverflowGenerations,
      countMonthlyQuotaUnits: deps.countMonthlyQuotaUnits,
      reserveMonthlyQuota: deps.reserveMonthlyQuota,
      commitMonthlyQuota: deps.commitMonthlyQuota,
      refundMonthlyQuota: deps.refundMonthlyQuota,
      consumeCredits: deps.consumeCredits,
      refundConsumedCredit: deps.refundConsumedCredit,
      verifyTurnstile: deps.verifyTurnstile,
      acquireGuestIpLimit: deps.acquireGuestIpLimit,
    });

    return responseHeaders.apply(await postAction(req));
  });
}

function createGetTextToSpeechDownload(deps: TextToSpeechRoutesDeps) {
  return withTextToSpeechApi(deps, async (req, context) => {
    const api = deps.createApiContext(req);
    const { responseHeaders, resolveActor } =
      createTextToSpeechRequestDeps(deps);
    const generationId = await readRouteId(context);
    const actor = await resolveActor(req);
    const download = await resolveTextToSpeechDownload({
      actor,
      generationId,
      deps: {
        findGenerationById: deps.findGenerationById,
      },
    });
    const file = await readAudioFile(deps, download.storageKey);
    api.log.debug('tts: download resolved', {
      generationId,
      contentLength: file.contentLength,
    });

    return responseHeaders.apply(
      new Response(file.body, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Type': file.contentType,
          'Content-Disposition': contentDisposition(download.filename),
          ...(file.contentLength
            ? { 'Content-Length': String(file.contentLength) }
            : {}),
        },
      })
    );
  });
}

export function createTextToSpeechRoutes(deps: TextToSpeechRoutesDeps) {
  return {
    getTextToSpeechDownload: createGetTextToSpeechDownload(deps),
    getTextToSpeechHistory: createGetTextToSpeechHistory(deps),
    getTextToSpeechQuota: createGetTextToSpeechQuota(deps),
    postTextToSpeechGenerate: createPostTextToSpeechGenerate(deps),
  };
}

export type TextToSpeechRouteTestActor = TextToSpeechActor;
export type TextToSpeechRouteTestStorage = Pick<
  StorageService,
  'deleteFiles' | 'getFile' | 'uploadFile'
>;
