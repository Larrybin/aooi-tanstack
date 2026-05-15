import type { StorageService } from '@/infra/adapters/storage/service-builder';

import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';
import { getUuid } from '@/shared/lib/hash';

import type { RemoverImageAssetKind } from '../domain/types';
import type {
  NewRemoverImageAsset,
  RemoverImageAsset,
} from '../infra/image-asset';
import type { RemoverJob } from '../infra/job';

const OUTPUT_IMAGE_EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

const MAX_OUTPUT_BYTES = 25 * 1024 * 1024;
const OUTPUT_DATA_URL_PATTERN = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/;
const LOW_RES_MAX_EDGE = 1280;
const LOW_RES_QUALITY = 72;
const LOW_RES_MIME_TYPE = 'image/webp';

export type StoreRemoverOutputImageDeps = {
  storageService: Pick<StorageService, 'uploadFile' | 'deleteFiles'>;
  createAssets: (assets: NewRemoverImageAsset[]) => Promise<RemoverImageAsset[]>;
  transformLowResImage?: (input: {
    buffer: Buffer;
    mimeType: string;
  }) => Promise<{ buffer: Buffer; mimeType: string }>;
  fetchImage?: (url: string) => Promise<Response>;
  createId?: () => string;
};

function resolveOutputExtension(mimeType: string): string {
  const ext =
    OUTPUT_IMAGE_EXT_BY_MIME[mimeType as keyof typeof OUTPUT_IMAGE_EXT_BY_MIME];
  if (!ext) {
    throw new UpstreamError(502, 'provider returned an unsupported image type');
  }
  return ext;
}

function resolveOwnerPath(job: RemoverJob): string {
  if (job.userId) {
    return `users/${job.userId}`;
  }

  if (job.anonymousSessionId) {
    return `anonymous/${job.anonymousSessionId}`;
  }

  throw new BadRequestError('remover job has no owner');
}

export async function storeRemoverOutputImage({
  job,
  outputImageUrl,
  deps,
}: {
  job: RemoverJob;
  outputImageUrl: string;
  deps: StoreRemoverOutputImageDeps;
}) {
  const output = await readProviderOutputImage(outputImageUrl, deps.fetchImage);
  const { buffer, mimeType } = output;
  if (buffer.byteLength <= 0) {
    throw new UpstreamError(502, 'provider output image is empty');
  }
  if (buffer.byteLength > MAX_OUTPUT_BYTES) {
    throw new UpstreamError(502, 'provider output image is too large');
  }

  const lowRes = await (
    deps.transformLowResImage ?? transformLowResImageWithCloudflareImages
  )({
    buffer,
    mimeType,
  });
  if (lowRes.buffer.byteLength <= 0) {
    throw new UpstreamError(502, 'low-res output image is empty');
  }

  const createId = deps.createId ?? getUuid;
  const id = createId();
  const ext = resolveOutputExtension(mimeType);
  const storageKey = `remover/${resolveOwnerPath(job)}/output/${id}.${ext}`;
  const thumbnailId = createId();
  const thumbnailExt = resolveOutputExtension(lowRes.mimeType);
  const thumbnailKey = `remover/${resolveOwnerPath(job)}/thumbnail/${thumbnailId}.${thumbnailExt}`;
  const uploadedKeys: string[] = [];

  try {
    const uploaded = await deps.storageService.uploadFile({
      body: buffer,
      key: storageKey,
      contentType: mimeType,
      disposition: 'inline',
    });

    if (!uploaded.success || !uploaded.key || !uploaded.url) {
      throw new UpstreamError(502, uploaded.error || 'output upload failed');
    }
    uploadedKeys.push(uploaded.key);

    const uploadedThumbnail = await deps.storageService.uploadFile({
      body: lowRes.buffer,
      key: thumbnailKey,
      contentType: lowRes.mimeType,
      disposition: 'inline',
    });

    if (
      !uploadedThumbnail.success ||
      !uploadedThumbnail.key ||
      !uploadedThumbnail.url
    ) {
      throw new UpstreamError(
        502,
        uploadedThumbnail.error || 'low-res output upload failed'
      );
    }
    uploadedKeys.push(uploadedThumbnail.key);

    const assets = await deps.createAssets([
      {
        id,
        userId: job.userId,
        anonymousSessionId: job.anonymousSessionId,
        kind: 'output' satisfies RemoverImageAssetKind,
        storageKey: uploaded.key,
        url: uploaded.url,
        mimeType,
        byteSize: buffer.byteLength,
        width: null,
        height: null,
        status: 'active',
        expiresAt: job.expiresAt,
      },
      {
        id: thumbnailId,
        userId: job.userId,
        anonymousSessionId: job.anonymousSessionId,
        kind: 'thumbnail' satisfies RemoverImageAssetKind,
        storageKey: uploadedThumbnail.key,
        url: uploadedThumbnail.url,
        mimeType: lowRes.mimeType,
        byteSize: lowRes.buffer.byteLength,
        width: null,
        height: null,
        status: 'active',
        expiresAt: job.expiresAt,
      },
    ]);
    const outputAsset = assets.find((asset) => asset.id === id);
    const thumbnailAsset = assets.find((asset) => asset.id === thumbnailId);
    if (!outputAsset || !thumbnailAsset) {
      throw new UpstreamError(502, 'output asset record creation failed');
    }

    return { outputAsset, thumbnailAsset };
  } catch (error) {
    if (uploadedKeys.length) {
      await deps.storageService.deleteFiles(uploadedKeys).catch(() => undefined);
    }
    throw error;
  }
}

async function readProviderOutputImage(
  outputImageUrl: string,
  fetchImage?: (url: string) => Promise<Response>
) {
  const dataUrl = parseOutputDataUrl(outputImageUrl);
  if (dataUrl) {
    return dataUrl;
  }

  const response = await (fetchImage ?? fetchProviderOutputImage)(
    outputImageUrl
  );
  if (!response.ok) {
    throw new UpstreamError(502, 'failed to fetch provider output image');
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim();
  if (!mimeType) {
    throw new UpstreamError(502, 'provider output image has no content type');
  }

  return {
    mimeType,
    buffer: await readResponseBufferWithLimit(response, MAX_OUTPUT_BYTES),
  };
}

function assertContentLengthWithinLimit(response: Response, maxBytes: number) {
  const contentLength = response.headers.get('content-length')?.trim();
  if (!contentLength) {
    return;
  }

  const parsed = Number.parseInt(contentLength, 10);
  if (Number.isFinite(parsed) && parsed > maxBytes) {
    throw new UpstreamError(502, 'provider output image is too large');
  }
}

async function readResponseBufferWithLimit(
  response: Response,
  maxBytes: number
): Promise<Buffer> {
  assertContentLengthWithinLimit(response, maxBytes);

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new UpstreamError(502, 'provider output image is too large');
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new UpstreamError(502, 'provider output image is too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

function parseOutputDataUrl(outputImageUrl: string) {
  const match = outputImageUrl.match(OUTPUT_DATA_URL_PATTERN);
  if (!match) {
    return null;
  }

  const base64 = match[2];
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_OUTPUT_BYTES) {
    throw new UpstreamError(502, 'provider output image is too large');
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(base64, 'base64'),
  };
}

async function fetchProviderOutputImage(url: string): Promise<Response> {
  const { safeFetch } = await import('@/shared/lib/fetch/server');
  return safeFetch(
    url,
    {
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
      },
    },
    {
      timeoutMs: 15000,
    }
  );
}

export async function transformLowResImageWithCloudflareImages({
  buffer,
  mimeType,
  images,
}: {
  buffer: Buffer;
  mimeType: string;
  images?: Pick<ImagesBinding, 'input'> | null;
}) {
  let binding = images;
  if (!binding) {
    const { getCloudflareImagesBinding } = await import(
      '@/infra/runtime/env.server'
    );
    binding = getCloudflareImagesBinding();
  }
  if (!binding) {
    throw new UpstreamError(503, 'Cloudflare Images binding is missing');
  }

  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  const stream = new Blob([arrayBuffer], { type: mimeType }).stream();

  const result = await binding
    .input(stream)
    .transform({
      width: LOW_RES_MAX_EDGE,
      height: LOW_RES_MAX_EDGE,
      fit: 'scale-down',
    })
    .output({
      format: LOW_RES_MIME_TYPE,
      quality: LOW_RES_QUALITY,
    });
  const response = result.response();

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType:
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      result.contentType() ||
      LOW_RES_MIME_TYPE,
  };
}
