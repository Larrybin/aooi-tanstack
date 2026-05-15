import { type CloudflareAIBinding } from '@/infra/runtime/env.server';

import {
  AIMediaType,
  AITaskStatus,
  type AIProvider,
  type AITaskResult,
} from '@/extensions/ai';
import { ServiceUnavailableError } from '@/shared/lib/api/errors';
import { getUuid } from '@/shared/lib/hash';

import type { RemoverJobStatus } from '../domain/types';

export const CLOUDFLARE_WORKERS_AI_PROVIDER = 'cloudflare-workers-ai';
export const DEFAULT_CLOUDFLARE_INPAINTING_MODEL =
  '@cf/runwayml/stable-diffusion-v1-5-inpainting';
const MAX_PROVIDER_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_WORKERS_AI_OUTPUT_BYTES = 25 * 1024 * 1024;
const REMOVER_PROMPT =
  'Remove the masked unwanted object and naturally reconstruct the background.';

export type RemoverProviderConfig = {
  provider: string;
  model: string;
};

export type RemoverProviderTaskResult = {
  providerTaskId: string;
  status: RemoverJobStatus;
  outputImageUrl?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type RemoverProviderAdapter = {
  config: RemoverProviderConfig;
  submitTask(input: {
    inputImageUrl: string;
    maskImageUrl: string;
  }): Promise<RemoverProviderTaskResult>;
  getTaskStatus(input: {
    providerTaskId: string;
  }): Promise<RemoverProviderTaskResult>;
};

function mapAITaskStatus(status: AITaskStatus): RemoverJobStatus {
  if (status === AITaskStatus.SUCCESS) {
    return 'succeeded';
  }

  if (status === AITaskStatus.FAILED || status === AITaskStatus.CANCELED) {
    return 'failed';
  }

  if (status === AITaskStatus.PROCESSING) {
    return 'processing';
  }

  return 'queued';
}

function firstOutputImageUrl(result: AITaskResult): string | undefined {
  return result.taskInfo?.images?.find((image) => image.imageUrl)?.imageUrl;
}

function toRemoverProviderTaskResult(
  result: AITaskResult
): RemoverProviderTaskResult {
  return {
    providerTaskId: result.taskId,
    status: mapAITaskStatus(result.taskStatus),
    outputImageUrl: firstOutputImageUrl(result),
    errorCode: result.taskInfo?.errorCode ?? null,
    errorMessage: result.taskInfo?.errorMessage ?? null,
  };
}

export function createRemoverInputImageFetcher({
  allowLocalHttp = false,
  safeFetchImpl,
}: {
  allowLocalHttp?: boolean;
  safeFetchImpl?: (
    url: string,
    init?: RequestInit,
    options?: Record<string, unknown>
  ) => Promise<Response>;
} = {}) {
  return async function fetchImageBytes(url: string): Promise<number[]> {
    const safeFetch =
      safeFetchImpl ?? (await import('@/shared/lib/fetch/server')).safeFetch;
    const response = await safeFetch(
      url,
      {
        headers: {
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        },
      },
      {
        timeoutMs: 15000,
        allowInsecureHttp: allowLocalHttp,
        allowPrivateNetwork: allowLocalHttp,
      }
    );
    if (!response.ok) {
      throw new ServiceUnavailableError(
        'failed to fetch remover provider input'
      );
    }

    const mimeType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim();
    if (!mimeType?.startsWith('image/')) {
      throw new ServiceUnavailableError(
        'remover provider input is not an image'
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength <= 0) {
      throw new ServiceUnavailableError('remover provider input is empty');
    }
    if (buffer.byteLength > MAX_PROVIDER_INPUT_BYTES) {
      throw new ServiceUnavailableError('remover provider input is too large');
    }

    return Array.from(buffer);
  };
}

const fetchImageBytes = createRemoverInputImageFetcher();

function dataUrlFromBuffer(mimeType: string, buffer: Buffer): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function assertWorkersAIOutputBufferSize(buffer: Buffer): void {
  if (buffer.byteLength > MAX_WORKERS_AI_OUTPUT_BYTES) {
    throw new ServiceUnavailableError('Workers AI output image is too large');
  }
}

function assertWorkersAIOutputContentLength(response: Response): void {
  const contentLength = response.headers.get('content-length')?.trim();
  if (!contentLength) {
    return;
  }

  const parsed = Number.parseInt(contentLength, 10);
  if (Number.isFinite(parsed) && parsed > MAX_WORKERS_AI_OUTPUT_BYTES) {
    throw new ServiceUnavailableError('Workers AI output image is too large');
  }
}

function readWorkersAIOutputMimeType(response: Response): string {
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim();
  return mimeType?.startsWith('image/') ? mimeType : 'image/png';
}

async function readWorkersAIOutputStream(
  stream: ReadableStream<Uint8Array>
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > MAX_WORKERS_AI_OUTPUT_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new ServiceUnavailableError(
          'Workers AI output image is too large'
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

async function readWorkersAIResponseBuffer(
  response: Response
): Promise<Buffer> {
  assertWorkersAIOutputContentLength(response);

  if (response.body) {
    return readWorkersAIOutputStream(response.body);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  assertWorkersAIOutputBufferSize(buffer);
  return buffer;
}

async function toPngDataUrl(output: unknown): Promise<string> {
  if (output instanceof Response) {
    if (!output.ok) {
      throw new ServiceUnavailableError(
        'Workers AI returned an error response'
      );
    }
    return dataUrlFromBuffer(
      readWorkersAIOutputMimeType(output),
      await readWorkersAIResponseBuffer(output)
    );
  }

  if (output instanceof ReadableStream) {
    return dataUrlFromBuffer(
      'image/png',
      await readWorkersAIOutputStream(output)
    );
  }

  if (output instanceof ArrayBuffer) {
    const buffer = Buffer.from(output);
    assertWorkersAIOutputBufferSize(buffer);
    return dataUrlFromBuffer('image/png', buffer);
  }

  if (ArrayBuffer.isView(output)) {
    const buffer = Buffer.from(
      output.buffer,
      output.byteOffset,
      output.byteLength
    );
    assertWorkersAIOutputBufferSize(buffer);
    return dataUrlFromBuffer('image/png', buffer);
  }

  throw new ServiceUnavailableError('Workers AI returned unsupported output');
}

export function createAIProviderRemoverAdapter({
  provider,
  model,
}: {
  provider: AIProvider;
  model: string;
}): RemoverProviderAdapter {
  const config = {
    provider: provider.name,
    model,
  };

  return {
    config,
    async submitTask({ inputImageUrl, maskImageUrl }) {
      const result = await provider.generate({
        params: {
          mediaType: AIMediaType.IMAGE,
          model,
          prompt: REMOVER_PROMPT,
          options: {
            image: inputImageUrl,
            mask: maskImageUrl,
          },
        },
      });

      return toRemoverProviderTaskResult(result);
    },
    async getTaskStatus({ providerTaskId }) {
      if (!provider.query) {
        throw new ServiceUnavailableError(
          `AI provider '${provider.name}' does not support task status queries`
        );
      }

      const result = await provider.query({ taskId: providerTaskId });
      return toRemoverProviderTaskResult(result);
    },
  };
}

export function createCloudflareWorkersAIRemoverAdapter({
  ai,
  model = DEFAULT_CLOUDFLARE_INPAINTING_MODEL,
  fetchInputImageBytes = fetchImageBytes,
  createProviderTaskId = () => `${CLOUDFLARE_WORKERS_AI_PROVIDER}:${getUuid()}`,
}: {
  ai: CloudflareAIBinding;
  model?: string;
  fetchInputImageBytes?: (url: string) => Promise<number[]>;
  createProviderTaskId?: () => string;
}): RemoverProviderAdapter {
  return {
    config: {
      provider: CLOUDFLARE_WORKERS_AI_PROVIDER,
      model,
    },
    async submitTask({ inputImageUrl, maskImageUrl }) {
      const [image, mask] = await Promise.all([
        fetchInputImageBytes(inputImageUrl),
        fetchInputImageBytes(maskImageUrl),
      ]);
      const output = await ai.run(model, {
        prompt: REMOVER_PROMPT,
        image,
        mask,
        num_steps: 20,
        strength: 1,
        guidance: 7.5,
      });

      return {
        providerTaskId: createProviderTaskId(),
        status: 'succeeded',
        outputImageUrl: await toPngDataUrl(output),
        errorCode: null,
        errorMessage: null,
      };
    },
    async getTaskStatus() {
      throw new ServiceUnavailableError(
        'Workers AI remover tasks complete during submit'
      );
    },
  };
}
