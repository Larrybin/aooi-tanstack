import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  buildRemoverWorkersAILocalTopologyExtraVars,
  createRemoverUploadMultipartBody,
  createRemoverWorkersAISpikeImages,
  runRemoverWorkersAISpikeAgainstBaseUrl,
  runWithRemoverTopologyExitGuard,
  waitForRemoverApiReady,
} from '../../scripts/run-remover-workers-ai-spike.mjs';

const model = '@cf/runwayml/stable-diffusion-v1-5-inpainting';

function ok(data: unknown, status = 200, init: ResponseInit = {}) {
  return Response.json(
    { code: 0, message: 'ok', data },
    {
      ...init,
      status,
    }
  );
}

test('createRemoverWorkersAISpikeImages returns PNG original and mask fixtures', () => {
  const images = createRemoverWorkersAISpikeImages();
  const pngSignature = '89504e470d0a1a0a';

  assert.equal(images.width, 512);
  assert.equal(images.height, 512);
  assert.equal(images.original.subarray(0, 8).toString('hex'), pngSignature);
  assert.equal(images.mask.subarray(0, 8).toString('hex'), pngSignature);
  assert.ok(images.original.length > 1000);
  assert.ok(images.mask.length > 1000);
});

test('buildRemoverWorkersAILocalTopologyExtraVars keeps auth origin site-scoped for local topology', () => {
  assert.deepEqual(
    buildRemoverWorkersAILocalTopologyExtraVars({
      model,
      authBaseUrl: 'https://airemover.example.com',
    }),
    {
      AUTH_URL: 'https://airemover.example.com',
      BETTER_AUTH_URL: 'https://airemover.example.com',
      REMOVER_AI_PROVIDER: 'cloudflare-workers-ai',
      REMOVER_AI_MODEL: model,
    }
  );
});

test('runWithRemoverTopologyExitGuard fails when Wrangler topology exits after ready', async () => {
  const child = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
  });

  const guarded = runWithRemoverTopologyExitGuard(
    {
      manager: {
        child,
      },
    },
    async () => new Promise(() => undefined)
  );

  child.emit('exit', 1, null);

  await assert.rejects(
    guarded,
    /Cloudflare local topology exited during remover Workers AI spike \(code=1\)/u
  );
});

test('waitForRemoverApiReady treats remover validation errors as readiness', async () => {
  const calls: string[] = [];

  await waitForRemoverApiReady({
    baseUrl: 'http://127.0.0.1:8787/',
    timeoutMs: 500,
    logger: {
      log: () => undefined,
    } as never,
    fetchImpl: async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(String(input));
      assert.equal(init?.method, 'POST');
      assert.equal(init?.body, '{}');
      return Response.json(
        { code: 400, message: 'invalid body' },
        {
          status: 400,
        }
      );
    },
  });

  assert.deepEqual(calls, ['http://127.0.0.1:8787/api/remover/jobs']);
});

test('createRemoverUploadMultipartBody includes content length for Wrangler upload parsing', () => {
  const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const multipart = createRemoverUploadMultipartBody({
    kind: 'original',
    fileName: 'fixture.png',
    image,
    width: 512,
    height: 512,
  });
  const text = multipart.bodyBytes.toString('latin1');

  assert.match(multipart.contentType, /^multipart\/form-data; boundary=/u);
  assert.equal(multipart.body.type, multipart.contentType);
  assert.equal(multipart.contentLength, String(multipart.bodyBytes.byteLength));
  assert.equal(multipart.body.size, multipart.bodyBytes.byteLength);
  assert.match(text, /name="kind"\r\n\r\noriginal/u);
  assert.match(text, /name="width"\r\n\r\n512/u);
  assert.match(text, /name="height"\r\n\r\n512/u);
  assert.match(text, /name="image"; filename="fixture\.png"/u);
  assert.ok(multipart.bodyBytes.includes(image));
});

test('runRemoverWorkersAISpikeAgainstBaseUrl uploads assets and creates a Workers AI remover job', async () => {
  const calls: Array<{
    url: string;
    method: string;
    body: BodyInit | null | undefined;
  }> = [];
  let uploadCount = 0;

  async function fetchImpl(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);
    calls.push({
      url,
      method: init?.method || 'GET',
      body: init?.body,
    });

    if (url.endsWith('/api/remover/upload')) {
      uploadCount += 1;
      if (uploadCount === 1) {
        assert.equal(
          (init?.headers as Record<string, string>).Cookie,
          undefined
        );
      } else {
        assert.equal(
          (init?.headers as Record<string, string>).Cookie,
          'remover_session=signed_session'
        );
      }
      assert.ok(init?.body instanceof Blob);
      assert.match(
        String((init.headers as Record<string, string>)['Content-Type']),
        /^multipart\/form-data; boundary=/u
      );
      assert.equal(
        (init.headers as Record<string, string>)['Content-Length'],
        undefined
      );
      const bodyText = Buffer.from(await init.body.arrayBuffer()).toString(
        'latin1'
      );
      const kind = bodyText.includes('\r\n\r\nmask\r\n') ? 'mask' : 'original';
      assert.match(bodyText, /name="width"\r\n\r\n512/u);
      assert.match(bodyText, /name="height"\r\n\r\n512/u);
      assert.match(bodyText, /name="image"; filename="workers-ai-spike-/u);

      return ok(
        {
          asset: {
            id: `${kind}-asset`,
            kind,
          },
          anonymousSessionId: 'anon_test',
        },
        200,
        uploadCount === 1
          ? {
              headers: {
                'Set-Cookie':
                  'remover_session=signed_session; Path=/; HttpOnly',
              },
            }
          : {}
      );
    }

    if (url.endsWith('/api/remover/jobs')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'remover_session=signed_session'
      );
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.inputImageAssetId, 'original-asset');
      assert.equal(body.maskImageAssetId, 'mask-asset');
      assert.match(body.idempotencyKey, /^workers-ai-spike-/u);

      return ok(
        {
          reused: false,
          job: {
            id: 'job_test',
            status: 'succeeded',
            lowResDownloadAvailable: true,
            highResDownloadRequiresSignIn: true,
          },
        },
        201
      );
    }

    if (url.endsWith('/api/remover/download/low-res')) {
      assert.equal(
        (init?.headers as Record<string, string>).Cookie,
        'remover_session=signed_session'
      );
      const body = JSON.parse(String(init?.body || '{}'));
      assert.equal(body.jobId, 'job_test');

      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    }

    throw new Error(`unexpected request ${url}`);
  }

  const result = await runRemoverWorkersAISpikeAgainstBaseUrl({
    baseUrl: 'http://127.0.0.1:8787/',
    fetchImpl,
    model,
  });

  assert.equal(uploadCount, 2);
  assert.deepEqual(
    calls.map((call) => [call.method, call.url]),
    [
      ['POST', 'http://127.0.0.1:8787/api/remover/upload'],
      ['POST', 'http://127.0.0.1:8787/api/remover/upload'],
      ['POST', 'http://127.0.0.1:8787/api/remover/jobs'],
      ['POST', 'http://127.0.0.1:8787/api/remover/download/low-res'],
    ]
  );
  assert.deepEqual(result, {
    jobId: 'job_test',
    status: 'succeeded',
    lowResContentType: 'image/png',
    lowResBytes: 4,
    highResDownloadRequiresSignIn: true,
    anonymousSessionId: 'anon_test',
  });
});

test('runRemoverWorkersAISpikeAgainstBaseUrl rejects leaked internal job fields', async () => {
  async function fetchImpl(input: string | URL | Request, init?: RequestInit) {
    const url = String(input);

    if (url.endsWith('/api/remover/upload')) {
      assert.ok(init?.body instanceof Blob);
      const bodyText = Buffer.from(await init.body.arrayBuffer()).toString(
        'latin1'
      );
      const kind = bodyText.includes('\r\n\r\nmask\r\n') ? 'mask' : 'original';
      return ok({
        asset: {
          id: `${kind}-asset`,
          kind,
        },
        anonymousSessionId: 'anon_test',
      });
    }

    if (url.endsWith('/api/remover/jobs')) {
      return ok(
        {
          reused: false,
          job: {
            id: 'job_test',
            status: 'succeeded',
            lowResDownloadAvailable: true,
            highResDownloadRequiresSignIn: true,
            outputImageKey: 'remover/anonymous/anon_test/output/job_test.png',
          },
        },
        201
      );
    }

    throw new Error(`unexpected request ${url}`);
  }

  await assert.rejects(
    runRemoverWorkersAISpikeAgainstBaseUrl({
      baseUrl: 'http://127.0.0.1:8787/',
      fetchImpl,
      model,
    }),
    /create remover job exposed internal job field: outputImageKey/u
  );
});
