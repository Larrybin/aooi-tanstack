import type { StorageService } from '@/infra/adapters/storage/service-builder';

import {
  BadRequestError,
  ServiceUnavailableError,
  UpstreamError,
} from '@/shared/lib/api/errors';

const MAX_FILES = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
export const MAX_TOTAL_FILES_SIZE_BYTES = 20 * 1024 * 1024; // 20MB per request

const IMAGE_EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
} as const;

type AllowedImageMimeType = keyof typeof IMAGE_EXT_BY_MIME;

function hasBytesPrefix(buffer: Buffer, prefix: readonly number[]): boolean {
  if (buffer.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i += 1) {
    if (buffer[i] !== prefix[i]) return false;
  }
  return true;
}

function hasAsciiAt(buffer: Buffer, value: string, offset: number): boolean {
  if (offset < 0) return false;
  if (buffer.length < offset + value.length) return false;
  return buffer.toString('ascii', offset, offset + value.length) === value;
}

function isJpeg(buffer: Buffer): boolean {
  return hasBytesPrefix(buffer, [0xff, 0xd8, 0xff]);
}

function isPng(buffer: Buffer): boolean {
  return hasBytesPrefix(
    buffer,
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  );
}

function isGif(buffer: Buffer): boolean {
  return hasAsciiAt(buffer, 'GIF87a', 0) || hasAsciiAt(buffer, 'GIF89a', 0);
}

function isWebp(buffer: Buffer): boolean {
  return hasAsciiAt(buffer, 'RIFF', 0) && hasAsciiAt(buffer, 'WEBP', 8);
}

const AVIF_BRANDS = new Set(['avif', 'avis']);

function isAvif(buffer: Buffer): boolean {
  if (buffer.length < 16) return false;
  if (!hasAsciiAt(buffer, 'ftyp', 4)) return false;

  const boxSize = buffer.readUInt32BE(0);
  let limit = Math.min(buffer.length, 64);
  if (boxSize === 0) {
    // box extends to EOF; keep a small scan window
  } else if (boxSize >= 16 && boxSize <= buffer.length) {
    limit = boxSize;
  } else {
    return false;
  }

  const majorBrand = buffer.toString('ascii', 8, 12);
  if (AVIF_BRANDS.has(majorBrand)) return true;

  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    const brand = buffer.toString('ascii', offset, offset + 4);
    if (AVIF_BRANDS.has(brand)) return true;
  }
  return false;
}

function isIco(buffer: Buffer): boolean {
  return hasBytesPrefix(buffer, [0x00, 0x00, 0x01, 0x00]);
}

export function detectAllowedImageMime(
  buffer: Buffer
): AllowedImageMimeType | null {
  if (isJpeg(buffer)) return 'image/jpeg';
  if (isPng(buffer)) return 'image/png';
  if (isWebp(buffer)) return 'image/webp';
  if (isGif(buffer)) return 'image/gif';
  if (isAvif(buffer)) return 'image/avif';
  if (isIco(buffer)) return 'image/x-icon';
  return null;
}

type UploadImageDeps = {
  getStorageService: () => Promise<
    Pick<StorageService, 'uploadFile'>
  >;
  log: {
    error: (message: string, meta?: Record<string, unknown>) => void;
  };
  now?: () => number;
  createId?: () => string;
};

export async function uploadImageFiles({
  files,
  deps,
}: {
  files: File[];
  deps: UploadImageDeps;
}) {
  const {
    getStorageService: getStorageServiceFromDeps,
    log,
    now = Date.now,
    createId,
  } = deps;

  if (!files || files.length === 0) {
    throw new BadRequestError('no files provided');
  }

  if (files.length > MAX_FILES) {
    throw new BadRequestError(`too many files (max ${MAX_FILES})`);
  }

  let storageService;
  try {
    storageService = await getStorageServiceFromDeps();
  } catch (error: unknown) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }
    log.error('[API] Storage service init failed', { error });
    throw new UpstreamError(503, 'storage service unavailable');
  }

  const uploadResults: Array<{ url: string; key: string; filename: string }> =
    [];
  let totalBytes = 0;

  for (const file of files) {
    if (!file.size || file.size <= 0) {
      throw new BadRequestError(`file ${file.name} is empty`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestError(
        `file ${file.name} is too large (max ${MAX_FILE_SIZE_BYTES} bytes)`
      );
    }

    totalBytes += file.size;
    if (totalBytes > MAX_TOTAL_FILES_SIZE_BYTES) {
      throw new BadRequestError(
        `total upload size is too large (max ${MAX_TOTAL_FILES_SIZE_BYTES} bytes)`
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const detectedMime = detectAllowedImageMime(buffer);
    if (!detectedMime) {
      throw new BadRequestError(`file ${file.name} is not a supported image`);
    }

    const ext = IMAGE_EXT_BY_MIME[detectedMime];
    const key = `uploads/${now()}-${(createId ?? (() => crypto.randomUUID()))()}.${ext}`;

    let result;
    try {
      result = await storageService.uploadFile({
        body: buffer,
        key,
        contentType: detectedMime,
        disposition: 'inline',
      });
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableError) {
        throw error;
      }
      log.error('[API] Upload threw', { error });
      throw new UpstreamError(503, 'upload service unavailable');
    }

    if (!result.success) {
      log.error('[API] Upload failed', { error: result.error });
      throw new UpstreamError(502, result.error || 'upload failed');
    }
    if (!result.url || !result.key) {
      log.error('[API] Upload response missing url/key', { result });
      throw new UpstreamError(502, 'upload failed');
    }

    uploadResults.push({
      url: result.url,
      key: result.key,
      filename: file.name,
    });
  }

  return uploadResults;
}

export function isFileValue(value: FormDataEntryValue): value is File {
  return typeof value === 'object' && value !== null && 'arrayBuffer' in value;
}
