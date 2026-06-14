import 'server-only';

import {
  CLOUDFLARE_WORKERS_AI_PROVIDER,
  createAIProviderRemoverAdapter,
  createCloudflareWorkersAIRemoverAdapter,
  createRemoverInputImageFetcher,
  DEFAULT_CLOUDFLARE_INPAINTING_MODEL,
  type RemoverProviderAdapter,
} from '@/domains/remover/application/provider';
import { getStorageService } from '@/infra/adapters/storage/service';
import {
  getCloudflareAIBinding,
  getRuntimeEnvString,
} from '@/infra/runtime/env.server';

import { ServiceUnavailableError } from '@/shared/lib/api/errors';

const MAX_LOCAL_PROVIDER_INPUT_BYTES = 25 * 1024 * 1024;

function resolveStorageKeyFromPublicUrl(url: string): string | null {
  const publicBaseUrl = getRuntimeEnvString('STORAGE_PUBLIC_BASE_URL')?.trim();
  if (!publicBaseUrl) {
    return null;
  }

  let inputUrl: URL;
  let baseUrl: URL;
  try {
    inputUrl = new URL(url);
    baseUrl = new URL(publicBaseUrl);
  } catch {
    return null;
  }

  const basePath = baseUrl.pathname.endsWith('/')
    ? baseUrl.pathname
    : `${baseUrl.pathname}/`;
  if (inputUrl.origin !== baseUrl.origin) {
    return null;
  }
  if (!inputUrl.pathname.startsWith(basePath)) {
    return null;
  }

  return decodeURIComponent(inputUrl.pathname.slice(basePath.length));
}

function createLocalSmokeInputImageFetcher() {
  const fallbackFetch = createRemoverInputImageFetcher({
    allowLocalHttp: true,
  });

  return async (url: string): Promise<number[]> => {
    const storageKey = resolveStorageKeyFromPublicUrl(url);
    if (!storageKey) {
      return fallbackFetch(url);
    }

    const storage = await getStorageService();
    const file = await storage.getFile(storageKey);
    if (!file?.body) {
      throw new ServiceUnavailableError('remover provider input is missing');
    }
    if (!file.contentType.startsWith('image/')) {
      throw new ServiceUnavailableError(
        'remover provider input is not an image'
      );
    }
    if (
      file.contentLength !== null &&
      file.contentLength > MAX_LOCAL_PROVIDER_INPUT_BYTES
    ) {
      throw new ServiceUnavailableError('remover provider input is too large');
    }

    const buffer = Buffer.from(await new Response(file.body).arrayBuffer());
    if (buffer.byteLength <= 0) {
      throw new ServiceUnavailableError('remover provider input is empty');
    }
    if (buffer.byteLength > MAX_LOCAL_PROVIDER_INPUT_BYTES) {
      throw new ServiceUnavailableError('remover provider input is too large');
    }

    return Array.from(buffer);
  };
}

export async function resolveRemoverProviderAdapter(): Promise<RemoverProviderAdapter> {
  const providerName =
    getRuntimeEnvString('REMOVER_AI_PROVIDER')?.trim() ||
    CLOUDFLARE_WORKERS_AI_PROVIDER;
  const configuredModel = getRuntimeEnvString('REMOVER_AI_MODEL')?.trim();
  const model =
    configuredModel ||
    (providerName === CLOUDFLARE_WORKERS_AI_PROVIDER
      ? DEFAULT_CLOUDFLARE_INPAINTING_MODEL
      : '');
  if (!model) {
    throw new ServiceUnavailableError('REMOVER_AI_MODEL is not configured');
  }

  if (providerName === CLOUDFLARE_WORKERS_AI_PROVIDER) {
    const ai = getCloudflareAIBinding();
    if (!ai) {
      throw new ServiceUnavailableError('Cloudflare Workers AI is not bound');
    }

    return createCloudflareWorkersAIRemoverAdapter({
      ai,
      model,
      fetchInputImageBytes:
        getRuntimeEnvString('CF_LOCAL_SMOKE_WORKERS_DEV') === 'true'
          ? createLocalSmokeInputImageFetcher()
          : createRemoverInputImageFetcher(),
    });
  }

  const { getConfiguredAIService } =
    await import('@/domains/ai/application/service');
  const aiService = await getConfiguredAIService();
  const provider = aiService.getProvider(providerName);
  if (!provider) {
    throw new ServiceUnavailableError(
      `AI provider '${providerName}' is not configured`
    );
  }

  return createAIProviderRemoverAdapter({ provider, model });
}
