import '@/config/load-dotenv';

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import { resolveCloudflareAuthSecretValue } from './create-cf-secrets-file.mjs';
import {
  renderCloudflareLocalTopologyLogs,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { getCurrentSiteAppUrl } from './lib/current-site.mjs';
import { runPhaseSequence } from './lib/harness/scenario.mjs';
import {
  injectCloudflareLocalSmokeDevVars,
  resolveLocalSmokeDatabaseUrl,
} from './run-cf-local-smoke.mjs';

const defaultBaseUrl = 'http://localhost:8787';
const defaultAuthSecret = 'local-cloudflare-ai-remover-spike-0123456789';
const defaultModel = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
const imageSize = 512;
const removerApiReadyTimeoutMs = Number.parseInt(
  process.env.REMOVER_WORKERS_AI_SPIKE_READY_TIMEOUT_MS ||
    process.env.CF_LOCAL_SMOKE_READY_TIMEOUT_MS ||
    '90000',
  10
);
const removerApiReadyRequestTimeoutMs = Number.parseInt(
  process.env.CF_LOCAL_SMOKE_REQUEST_TIMEOUT_MS || '30000',
  10
);

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  return Buffer.concat([
    writeUInt32(data.length),
    typeBuffer,
    data,
    writeUInt32(crc32(Buffer.concat([typeBuffer, data]))),
  ]);
}

function createPng({ width, height, pixelAt }) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * stride;
    raw[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixelAt(x, y);
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  return Buffer.concat([
    header,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function createRemoverWorkersAISpikeImages() {
  const objectMin = Math.floor(imageSize * 0.36);
  const objectMax = Math.floor(imageSize * 0.64);

  const original = createPng({
    width: imageSize,
    height: imageSize,
    pixelAt(x, y) {
      if (
        x >= objectMin &&
        x <= objectMax &&
        y >= objectMin &&
        y <= objectMax
      ) {
        return [207, 73, 55, 255];
      }

      const shade = 222 + (Math.floor((x + y) / 64) % 18);
      return [shade, shade + 4, 235, 255];
    },
  });

  const mask = createPng({
    width: imageSize,
    height: imageSize,
    pixelAt(x, y) {
      const selected =
        x >= objectMin - 8 &&
        x <= objectMax + 8 &&
        y >= objectMin - 8 &&
        y <= objectMax + 8;
      return selected ? [255, 255, 255, 255] : [0, 0, 0, 255];
    },
  });

  return { original, mask, width: imageSize, height: imageSize };
}

async function readApiEnvelope(response, label) {
  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON ${response.status}: ${text}`);
  }

  if (!response.ok || payload.code !== 0) {
    throw new Error(
      `${label} failed ${response.status}: ${payload.message || text}`
    );
  }

  return payload.data;
}

function createHeaders({ baseUrl, userAgent, clientIp, cookie = '' }) {
  const headers = {
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    'User-Agent': userAgent,
    'X-Real-IP': clientIp,
  };
  if (cookie) {
    headers.Cookie = cookie;
  }
  return headers;
}

function readSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

function mergeCookieHeader(currentCookieHeader, setCookieHeaders) {
  const cookies = new Map();

  for (const item of currentCookieHeader.split(/;\s*/u)) {
    if (!item) {
      continue;
    }
    const equalsIndex = item.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }
    cookies.set(item.slice(0, equalsIndex), item.slice(equalsIndex + 1));
  }

  for (const header of setCookieHeaders) {
    const [cookiePair] = String(header).split(';');
    const equalsIndex = cookiePair.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }
    cookies.set(
      cookiePair.slice(0, equalsIndex),
      cookiePair.slice(equalsIndex + 1)
    );
  }

  return [...cookies.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function assertNoInternalJobFields(job, label) {
  const forbiddenFields = [
    'provider',
    'model',
    'providerTaskId',
    'outputImageKey',
    'outputImageUrl',
    'thumbnailKey',
    'inputImageKey',
    'maskImageKey',
  ];
  const leakedField = forbiddenFields.find((field) => field in job);
  if (leakedField) {
    throw new Error(`${label} exposed internal job field: ${leakedField}`);
  }
}

export function createRemoverUploadMultipartBody({
  kind,
  fileName,
  image,
  width,
  height,
}) {
  const boundary = `----aooi-remover-${randomUUID().replace(/-/gu, '')}`;
  const chunks = [];

  for (const [name, value] of [
    ['kind', kind],
    ['width', String(width)],
    ['height', String(height)],
  ]) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        'utf8'
      )
    );
  }

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`,
      'utf8'
    ),
    Buffer.from(image),
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8')
  );

  const bodyBytes = Buffer.concat(chunks);
  return {
    body: new Blob([bodyBytes], {
      type: `multipart/form-data; boundary=${boundary}`,
    }),
    contentType: `multipart/form-data; boundary=${boundary}`,
    contentLength: String(bodyBytes.byteLength),
    bodyBytes,
  };
}

async function uploadRemoverAsset({
  baseUrl,
  fetchImpl,
  kind,
  fileName,
  image,
  width,
  height,
  headers,
}) {
  const multipart = createRemoverUploadMultipartBody({
    kind,
    fileName,
    image,
    width,
    height,
  });

  const response = await fetchImpl(`${baseUrl}/api/remover/upload`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': multipart.contentType,
    },
    body: multipart.body,
  });
  const data = await readApiEnvelope(response, `upload ${kind}`);

  if (!data?.asset?.id) {
    throw new Error(`upload ${kind} did not return an asset id`);
  }

  return {
    ...data,
    setCookieHeaders: readSetCookieHeaders(response.headers),
  };
}

async function createRemoverJob({
  baseUrl,
  fetchImpl,
  inputImageAssetId,
  maskImageAssetId,
  idempotencyKey,
  headers,
}) {
  const response = await fetchImpl(`${baseUrl}/api/remover/jobs`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputImageAssetId,
      maskImageAssetId,
      idempotencyKey,
    }),
  });
  const data = await readApiEnvelope(response, 'create remover job');

  if (!data?.job?.id) {
    throw new Error('create remover job did not return a job');
  }
  assertNoInternalJobFields(data.job, 'create remover job');

  return data;
}

async function fetchRemoverJob({ baseUrl, fetchImpl, jobId, headers }) {
  const response = await fetchImpl(`${baseUrl}/api/remover/jobs/${jobId}`, {
    method: 'GET',
    headers,
  });
  const data = await readApiEnvelope(response, 'get remover job');

  if (!data?.job?.id) {
    throw new Error('get remover job did not return a job');
  }
  assertNoInternalJobFields(data.job, 'get remover job');

  return data.job;
}

async function downloadLowResRemoverResult({
  baseUrl,
  fetchImpl,
  jobId,
  headers,
}) {
  const response = await fetchImpl(`${baseUrl}/api/remover/download/low-res`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`download low-res failed ${response.status}: ${text}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error(
      `download low-res returned ${contentType || 'no content-type'}`
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('download low-res returned an empty image');
  }

  return {
    contentType,
    bytes,
  };
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitForRemoverApiReady({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = removerApiReadyTimeoutMs,
  userAgent = 'aooi-remover-workers-ai-spike/1.0',
  clientIp = '127.0.0.1',
  logger = console,
} = {}) {
  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, '');
  const headers = createHeaders({
    baseUrl: normalizedBaseUrl,
    userAgent,
    clientIp,
  });
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(
        `${normalizedBaseUrl}/api/remover/jobs`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: '{}',
          signal: AbortSignal.timeout(removerApiReadyRequestTimeoutMs),
        }
      );
      await response.text();

      if (response.status === 400 || response.status === 422) {
        logger.log(`✓ Remover API ready: ${normalizedBaseUrl}`);
        return;
      }

      lastError = new Error(
        `remover API readiness returned ${response.status}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(1000);
  }

  throw new Error(
    `Remover API not ready within ${timeoutMs}ms: ${
      lastError?.message || 'unknown error'
    }`
  );
}

async function waitForRemoverJob({
  baseUrl,
  fetchImpl,
  initialJob,
  headers,
  timeoutMs,
}) {
  const startedAt = Date.now();
  let job = initialJob;

  while (job.status !== 'succeeded' && job.status !== 'failed') {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`remover job ${job.id} did not finish before timeout`);
    }

    await sleep(2000);
    job = await fetchRemoverJob({
      baseUrl,
      fetchImpl,
      jobId: job.id,
      headers,
    });
  }

  return job;
}

export async function runRemoverWorkersAISpikeAgainstBaseUrl({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 90000,
  userAgent = 'aooi-remover-workers-ai-spike/1.0',
  clientIp = '127.0.0.1',
} = {}) {
  if (!baseUrl) {
    throw new Error('baseUrl is required');
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, '');
  const images = createRemoverWorkersAISpikeImages();
  let cookieHeader = '';
  const buildHeaders = () =>
    createHeaders({
      baseUrl: normalizedBaseUrl,
      userAgent,
      clientIp,
      cookie: cookieHeader,
    });
  const inputUpload = await uploadRemoverAsset({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    kind: 'original',
    fileName: 'workers-ai-spike-original.png',
    image: images.original,
    width: images.width,
    height: images.height,
    headers: buildHeaders(),
  });
  cookieHeader = mergeCookieHeader(cookieHeader, inputUpload.setCookieHeaders);
  const maskUpload = await uploadRemoverAsset({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    kind: 'mask',
    fileName: 'workers-ai-spike-mask.png',
    image: images.mask,
    width: images.width,
    height: images.height,
    headers: buildHeaders(),
  });
  cookieHeader = mergeCookieHeader(cookieHeader, maskUpload.setCookieHeaders);
  const headers = buildHeaders();
  const created = await createRemoverJob({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    inputImageAssetId: inputUpload.asset.id,
    maskImageAssetId: maskUpload.asset.id,
    idempotencyKey: `workers-ai-spike-${randomUUID()}`,
    headers,
  });
  const job = await waitForRemoverJob({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    initialJob: created.job,
    headers,
    timeoutMs,
  });

  if (job.status !== 'succeeded') {
    throw new Error(
      `remover job ${job.id} failed: ${job.errorMessage || job.errorCode || 'unknown error'}`
    );
  }

  if (!job.lowResDownloadAvailable) {
    throw new Error('succeeded remover job did not advertise low-res download');
  }

  if (!job.highResDownloadRequiresSignIn) {
    throw new Error(
      'anonymous remover job did not require sign-in for high-res download'
    );
  }

  const lowResDownload = await downloadLowResRemoverResult({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    jobId: job.id,
    headers,
  });

  return {
    jobId: job.id,
    status: job.status,
    lowResContentType: lowResDownload.contentType,
    lowResBytes: lowResDownload.bytes.length,
    highResDownloadRequiresSignIn: Boolean(job.highResDownloadRequiresSignIn),
    anonymousSessionId:
      inputUpload.anonymousSessionId || maskUpload.anonymousSessionId || '',
  };
}

export function buildRemoverWorkersAILocalTopologyExtraVars({
  model = defaultModel,
  authBaseUrl = getCurrentSiteAppUrl(),
} = {}) {
  return {
    AUTH_URL: authBaseUrl,
    BETTER_AUTH_URL: authBaseUrl,
    REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
    REMOVER_AI_MODEL: model,
  };
}

function formatTopologyExit(code, signal) {
  if (code !== null && code !== undefined) {
    return `code=${code}`;
  }

  return `signal=${signal || 'unknown'}`;
}

export async function runWithRemoverTopologyExitGuard(topology, action) {
  const child = topology?.manager?.child;
  if (!child) {
    return await action();
  }

  if (child.exitCode !== null) {
    throw new Error(
      `Cloudflare local topology exited during remover Workers AI spike (${formatTopologyExit(
        child.exitCode,
        child.signalCode
      )})`
    );
  }

  let removeExitListener = () => undefined;
  const exitPromise = new Promise((_, reject) => {
    const onExit = (code, signal) => {
      reject(
        new Error(
          `Cloudflare local topology exited during remover Workers AI spike (${formatTopologyExit(
            code,
            signal
          )})`
        )
      );
    };

    child.once('exit', onExit);
    removeExitListener = () => child.off('exit', onExit);
  });

  try {
    return await Promise.race([action(), exitPromise]);
  } finally {
    removeExitListener();
  }
}

function createLocalTopologyFailure(error, recentLogs) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /\btail\.developers\.workers\.dev\b/u.test(recentLogs) ||
    /\bECONNRESET\b/u.test(recentLogs) ||
    /\bNetwork connection lost\b/u.test(recentLogs)
  ) {
    return new Error(
      `Cloudflare Workers AI remote connection failed during the local remover spike: ${message}. Re-run after Wrangler can keep its remote AI/tail connection open.`
    );
  }

  return error;
}

export async function runLocalRemoverWorkersAISpike({
  baseUrl = defaultBaseUrl,
  databaseUrl = resolveLocalSmokeDatabaseUrl(),
  model = process.env.REMOVER_AI_MODEL?.trim() || defaultModel,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for local Workers AI remover spike'
    );
  }

  const authSecret = resolveCloudflareAuthSecretValue(process.env, {
    fallbackAuthSecret: defaultAuthSecret,
  });
  const topology = await startCloudflareLocalDevTopology({
    databaseUrl,
    routerBaseUrl: baseUrl,
    authSecret,
    extraVars: buildRemoverWorkersAILocalTopologyExtraVars({ model }),
  });
  const resolvedBaseUrl = topology.getRouterBaseUrl();

  try {
    let result;
    await runWithRemoverTopologyExitGuard(topology, async () => {
      await runPhaseSequence({
        phases: [
          {
            label: 'remover-api-ready',
            action: async () => {
              await waitForRemoverApiReady({ baseUrl: resolvedBaseUrl });
            },
          },
          {
            label: 'remover-workers-ai',
            action: async () => {
              result = await runRemoverWorkersAISpikeAgainstBaseUrl({
                baseUrl: resolvedBaseUrl,
              });
            },
          },
        ],
      });
    });

    return result;
  } catch (error) {
    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      console.error(recentLogs);
    }
    throw createLocalTopologyFailure(error, recentLogs);
  } finally {
    await topology.stop();
  }
}

async function main() {
  injectCloudflareLocalSmokeDevVars();

  const externalBaseUrl =
    process.env.REMOVER_WORKERS_AI_SPIKE_BASE_URL?.trim() || '';
  const model = process.env.REMOVER_AI_MODEL?.trim() || defaultModel;
  const result = externalBaseUrl
    ? await runRemoverWorkersAISpikeAgainstBaseUrl({
        baseUrl: externalBaseUrl,
      })
    : await runLocalRemoverWorkersAISpike({
        baseUrl: process.env.CF_LOCAL_SMOKE_URL?.trim() || defaultBaseUrl,
        model,
      });

  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
      },
      null,
      2
    )
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
