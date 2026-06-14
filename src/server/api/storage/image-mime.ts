const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/x-icon',
] as const;

type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

const ALLOWED_IMAGE_MIME_TYPE_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

export function isAllowedImageMimeType(
  value: string
): value is AllowedImageMimeType {
  return ALLOWED_IMAGE_MIME_TYPE_SET.has(value);
}

function hasBytesPrefix(buffer: Buffer, prefix: readonly number[]): boolean {
  if (buffer.length < prefix.length) return false;
  for (let index = 0; index < prefix.length; index += 1) {
    if (buffer[index] !== prefix[index]) return false;
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
