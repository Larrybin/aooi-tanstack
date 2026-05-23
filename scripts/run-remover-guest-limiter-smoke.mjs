import '@/config/load-dotenv';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REMOVER_GUEST_JOB_LIMIT_CONFIG,
  REMOVER_GUEST_UPLOAD_LIMIT_CONFIG,
} from '../src/shared/lib/api/limiters-config.ts';
import { resolveCloudflareAuthSecretValue } from './create-cf-secrets-file.mjs';
import {
  renderCloudflareLocalTopologyLogs,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { runPhaseSequence } from './lib/harness/scenario.mjs';
import {
  injectCloudflareLocalSmokeDevVars,
  resolveLocalSmokeDatabaseUrl,
} from './run-cf-local-smoke.mjs';
import {
  buildRemoverWorkersAILocalTopologyExtraVars,
  createRemoverUploadMultipartBody,
  createRemoverWorkersAISpikeImages,
  waitForRemoverApiReady,
} from './run-remover-workers-ai-spike.mjs';

const defaultBaseUrl = 'http://localhost:8787';
const defaultAuthSecret = 'local-cloudflare-smoke-secret-0123456789';
const defaultModel = '@cf/runwayml/stable-diffusion-v1-5-inpainting';
const userAgent = 'aooi-remover-guest-limiter-smoke/1.0';
const defaultClientIp = '198.51.100.77';

function createHeaders({ baseUrl, clientIp, cookie = '' }) {
  const headers = {
    Origin: baseUrl,
    Referer: `${baseUrl}/`,
    'User-Agent': userAgent,
    'CF-Connecting-IP': clientIp,
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

async function readResponsePayload(response, label) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON ${response.status}: ${text}`);
  }
}

function getPayloadMessage(payload) {
  return payload?.message || JSON.stringify(payload);
}

async function requestUploadAttempt({
  baseUrl,
  fetchImpl,
  headers,
  image,
  width,
  height,
  attempt,
}) {
  const multipart = createRemoverUploadMultipartBody({
    kind: 'original',
    fileName: `guest-limiter-upload-${attempt}.png`,
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

  return {
    status: response.status,
    ok: response.ok,
    payload: await readResponsePayload(response, `guest upload ${attempt}`),
    setCookieHeaders: readSetCookieHeaders(response.headers),
  };
}

async function requestJobAttempt({ baseUrl, fetchImpl, headers, attempt }) {
  const response = await fetchImpl(`${baseUrl}/api/remover/jobs`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputImageAssetId: `guest-limiter-missing-input-${attempt}`,
      maskImageAssetId: `guest-limiter-missing-mask-${attempt}`,
      idempotencyKey: `guest-limiter-${Date.now()}-${attempt}`,
    }),
  });

  return {
    status: response.status,
    payload: await readResponsePayload(response, `guest job ${attempt}`),
    setCookieHeaders: readSetCookieHeaders(response.headers),
  };
}

function assertBlockedByLimiter(result, label) {
  if (result.status !== 429) {
    throw new Error(
      `${label} did not return 429 after configured limit; got ${result.status}: ${getPayloadMessage(
        result.payload
      )}`
    );
  }
}

export async function runRemoverGuestLimiterSmokeAgainstBaseUrl({
  baseUrl,
  fetchImpl = fetch,
  clientIp = defaultClientIp,
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
      clientIp,
      cookie: cookieHeader,
    });

  for (
    let attempt = 1;
    attempt <= REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts;
    attempt += 1
  ) {
    const result = await requestUploadAttempt({
      baseUrl: normalizedBaseUrl,
      fetchImpl,
      headers: buildHeaders(),
      image: images.original,
      width: images.width,
      height: images.height,
      attempt,
    });
    cookieHeader = mergeCookieHeader(cookieHeader, result.setCookieHeaders);

    if (!result.ok || result.payload?.code !== 0) {
      throw new Error(
        `guest upload attempt ${attempt} failed before configured limit: ${result.status}: ${getPayloadMessage(
          result.payload
        )}`
      );
    }
  }

  const blockedUpload = await requestUploadAttempt({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    headers: buildHeaders(),
    image: images.original,
    width: images.width,
    height: images.height,
    attempt: REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts + 1,
  });
  assertBlockedByLimiter(blockedUpload, 'guest upload limiter');

  for (
    let attempt = 1;
    attempt <= REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts;
    attempt += 1
  ) {
    const result = await requestJobAttempt({
      baseUrl: normalizedBaseUrl,
      fetchImpl,
      headers: buildHeaders(),
      attempt,
    });
    cookieHeader = mergeCookieHeader(cookieHeader, result.setCookieHeaders);

    if (result.status === 429) {
      throw new Error(
        `guest job limiter blocked before configured limit on attempt ${attempt}: ${getPayloadMessage(
          result.payload
        )}`
      );
    }
  }

  const blockedJob = await requestJobAttempt({
    baseUrl: normalizedBaseUrl,
    fetchImpl,
    headers: buildHeaders(),
    attempt: REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts + 1,
  });
  assertBlockedByLimiter(blockedJob, 'guest job limiter');

  return {
    upload: {
      allowedAttempts: REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts,
      blockedStatus: blockedUpload.status,
    },
    job: {
      allowedAttempts: REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts,
      blockedStatus: blockedJob.status,
    },
  };
}

function formatTopologyExit(code, signal) {
  if (code !== null && code !== undefined) {
    return `code=${code}`;
  }

  return `signal=${signal || 'unknown'}`;
}

async function runWithTopologyExitGuard(topology, action) {
  const child = topology?.manager?.child;
  if (!child) {
    return await action();
  }

  let removeExitListener = () => undefined;
  const exitPromise = new Promise((_, reject) => {
    const onExit = (code, signal) => {
      reject(
        new Error(
          `Cloudflare local topology exited during remover guest limiter smoke (${formatTopologyExit(
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

export async function runLocalRemoverGuestLimiterSmoke({
  baseUrl = defaultBaseUrl,
  databaseUrl = resolveLocalSmokeDatabaseUrl(),
  model = process.env.REMOVER_AI_MODEL?.trim() || defaultModel,
  startCloudflareLocalDevTopologyImpl = startCloudflareLocalDevTopology,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for local remover guest limiter smoke'
    );
  }

  const authSecret = resolveCloudflareAuthSecretValue(process.env, {
    fallbackAuthSecret: defaultAuthSecret,
  });
  const topology = await startCloudflareLocalDevTopologyImpl({
    databaseUrl,
    routerBaseUrl: baseUrl,
    authSecret,
    extraVars: buildRemoverWorkersAILocalTopologyExtraVars({ model }),
  });
  const resolvedBaseUrl = topology.getRouterBaseUrl();

  try {
    let result;
    await runWithTopologyExitGuard(topology, async () => {
      await runPhaseSequence({
        phases: [
          {
            label: 'remover-api-ready',
            action: async () => {
              await waitForRemoverApiReady({
                baseUrl: resolvedBaseUrl,
                userAgent,
              });
            },
          },
          {
            label: 'remover-guest-limiter',
            action: async () => {
              result = await runRemoverGuestLimiterSmokeAgainstBaseUrl({
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
    throw error;
  } finally {
    await topology.stop();
  }
}

async function main() {
  injectCloudflareLocalSmokeDevVars();

  const externalBaseUrl =
    process.env.REMOVER_GUEST_LIMITER_SMOKE_BASE_URL?.trim() || '';
  const result = externalBaseUrl
    ? await runRemoverGuestLimiterSmokeAgainstBaseUrl({
        baseUrl: externalBaseUrl,
      })
    : await runLocalRemoverGuestLimiterSmoke({
        baseUrl: process.env.CF_LOCAL_SMOKE_URL?.trim() || defaultBaseUrl,
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
