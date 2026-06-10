import { PayloadTooLargeError } from '@/shared/lib/api/errors';

function contentLength(req: Request): number | null {
  const value = req.headers.get('content-length')?.trim();
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function assertContentLengthWithinLimit(
  req: Request,
  limitBytes: number
): void {
  const length = contentLength(req);
  if (length !== null && length > limitBytes) {
    throw new PayloadTooLargeError('payload too large');
  }
}

function isMultipartFormDataRequest(req: Request): boolean {
  const contentType = req.headers.get('content-type')?.toLowerCase() || '';
  return contentType.startsWith('multipart/form-data');
}

export async function readRequestTextWithLimit(
  req: Request,
  limitBytes: number
): Promise<string> {
  const body = req.body;
  if (!body) return '';

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytes += value.byteLength;
      if (bytes > limitBytes) {
        try {
          await reader.cancel();
        } catch {}
        throw new PayloadTooLargeError('payload too large');
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }

  return text + decoder.decode();
}

export async function readRequestBodyByteCountUpTo(
  req: Request,
  maxBytes: number
): Promise<{ bytesRead: number | null; truncated: boolean }> {
  const body = req.body;
  if (!body) {
    return { bytesRead: 0, truncated: false };
  }

  const reader = body.getReader();
  let bytesRead = 0;
  let truncated = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        truncated = true;
        break;
      }
    }
  } catch {
    return { bytesRead: null, truncated: false };
  } finally {
    if (truncated) {
      try {
        await reader.cancel();
      } catch {}
    } else {
      try {
        reader.releaseLock();
      } catch {}
    }
  }

  return {
    bytesRead: truncated ? maxBytes : bytesRead,
    truncated,
  };
}

export async function readRequestFormData(
  req: Request,
  limitBytes?: number
): Promise<FormData> {
  if (limitBytes !== undefined) {
    assertContentLengthWithinLimit(req, limitBytes);
    if (contentLength(req) === null && isMultipartFormDataRequest(req)) {
      throw new PayloadTooLargeError(
        'multipart payload requires content-length'
      );
    }
  }

  return req.formData();
}
