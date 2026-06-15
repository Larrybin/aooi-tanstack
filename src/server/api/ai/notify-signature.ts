import { getRuntimeEnvString } from '@/infra/runtime/env.server';

const SIGNATURE_ALGORITHM = 'SHA-256';

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

export function getAiNotifyWebhookSecret(): string {
  return getRuntimeEnvString('AI_NOTIFY_WEBHOOK_SECRET')?.trim() || '';
}

export function buildAiNotifySignaturePayload(input: {
  provider: string;
  taskId: string;
}): string {
  return `${input.provider}.${input.taskId}`;
}

export async function signAiNotifyCallback(input: {
  provider: string;
  taskId: string;
  secret: string;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input.secret),
    { name: 'HMAC', hash: SIGNATURE_ALGORITHM },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(buildAiNotifySignaturePayload(input))
  );

  return toHex(signature);
}

export async function verifyAiNotifyCallbackSignature(input: {
  provider: string;
  taskId: string;
  signature: string;
  secret: string;
}): Promise<boolean> {
  if (!input.signature.trim()) return false;

  const expected = await signAiNotifyCallback(input);
  return timingSafeEqual(expected, input.signature.trim().toLowerCase());
}
