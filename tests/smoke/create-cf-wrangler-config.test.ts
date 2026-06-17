import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { buildCloudflareWranglerConfig } from '../../scripts/create-cf-wrangler-config.mjs';
import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';

const contract = resolveSiteDeployContract({
  rootDir: process.cwd(),
  siteKey: 'mamamiya',
});
const aiRemoverContract = resolveSiteDeployContract({
  rootDir: process.cwd(),
  siteKey: 'ai-remover',
});
const aiRemoverPreviewContract = resolveSiteDeployContract({
  rootDir: process.cwd(),
  siteKey: 'ai-remover',
  deployProfile: 'preview',
  processEnv: {
    CF_WORKERS_DEV_SUBDOMAIN: 'aooi-preview',
  },
});
const textToSpeechContract = resolveSiteDeployContract({
  rootDir: process.cwd(),
  siteKey: 'text-to-speech-generator',
});
const mp4CompressorContract = resolveSiteDeployContract({
  rootDir: process.cwd(),
  siteKey: 'mp4-compressor',
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('buildCloudflareWranglerConfig 为 router 模板注入数据库、app url、deploy target 与 version vars', () => {
  const template = `
name = "router-template"
main = "cloudflare/workers/router.ts"

[assets]
directory = "dist/client"

[images]
binding = "IMAGES"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "http://localhost:3000"
STORAGE_PUBLIC_BASE_URL = ""
PUBLIC_WEB_WORKER_VERSION_ID = ""
AUTH_WORKER_VERSION_ID = ""
PAYMENT_WORKER_VERSION_ID = ""
MEMBER_WORKER_VERSION_ID = ""
CHAT_WORKER_VERSION_ID = ""
ADMIN_WORKER_VERSION_ID = ""
PUBLIC_WEB_WORKER_NAME = ""
AUTH_WORKER_NAME = ""
PAYMENT_WORKER_NAME = ""
MEMBER_WORKER_NAME = ""
CHAT_WORKER_NAME = ""
ADMIN_WORKER_NAME = ""
`;

  const outputPath = '/repo/.tmp/router/wrangler.cloudflare.deploy.toml';
  const config = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'router',
    databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:5432/aooi',
    appUrl: 'http://127.0.0.1:8787',
    storagePublicBaseUrl: 'http://127.0.0.1:8787/assets/',
    deployTarget: 'cloudflare',
    devHost: '127.0.0.1',
    devUpstreamProtocol: 'http',
    templatePath: '/repo/wrangler.cloudflare.toml',
    outputPath,
    versionVars: {
      PUBLIC_WEB_WORKER_VERSION_ID: 'v-public-web',
      AUTH_WORKER_VERSION_ID: 'v-auth',
    },
  });

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/cloudflare/workers/router.ts'))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `directory = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/dist/client'))}"`
    )
  );
  assert.match(
    config,
    /localConnectionString = "postgresql:\/\/postgres:postgres@127\.0\.0\.1:5432\/aooi"/
  );
  assert.match(config, /NEXT_PUBLIC_APP_URL = "http:\/\/127\.0\.0\.1:8787"/);
  assert.match(
    config,
    /STORAGE_PUBLIC_BASE_URL = "http:\/\/127\.0\.0\.1:8787\/assets\/"/
  );
  assert.match(config, /DEPLOY_TARGET = "cloudflare"/);
  assert.match(
    config,
    new RegExp(`pattern = "${escapeRegExp(contract.site.domain)}"`)
  );
  assert.match(config, /custom_domain = true/);
  assert.match(config, /PUBLIC_WEB_WORKER_VERSION_ID = "v-public-web"/);
  assert.match(config, /AUTH_WORKER_VERSION_ID = "v-auth"/);
  assert.match(
    config,
    new RegExp(
      `PUBLIC_WEB_WORKER_NAME = "${escapeRegExp(contract.serverWorkers['public-web'].workerName)}"`
    )
  );
  assert.match(config, /\[dev\][\s\S]*host = "127\.0\.0\.1"/);
  assert.match(config, /\[dev\][\s\S]*upstream_protocol = "http"/);
});

test('buildCloudflareWranglerConfig 为 preview router 启用 workers.dev 且不生成 routes', () => {
  const template = `
name = "router-template"
main = "cloudflare/workers/router.ts"
workers_dev = false
preview_urls = false

[assets]
directory = "dist/client"

[images]
binding = "IMAGES"

[[routes]]
pattern = "old.example.com"
custom_domain = true

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "placeholder-router"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
PUBLIC_WEB_WORKER_VERSION_ID = ""
AUTH_WORKER_VERSION_ID = ""
PAYMENT_WORKER_VERSION_ID = ""
MEMBER_WORKER_VERSION_ID = ""
CHAT_WORKER_VERSION_ID = ""
ADMIN_WORKER_VERSION_ID = ""
PUBLIC_WEB_WORKER_NAME = ""
AUTH_WORKER_NAME = ""
PAYMENT_WORKER_NAME = ""
MEMBER_WORKER_NAME = ""
CHAT_WORKER_NAME = ""
ADMIN_WORKER_NAME = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract: aiRemoverPreviewContract,
    workerSlot: 'router',
    templatePath: '/repo/wrangler.cloudflare.toml',
    outputPath: '/repo/.tmp/router.toml',
  });

  assert.match(config, /name = "aooi-ai-remover-preview-router"/);
  assert.match(config, /workers_dev = true/);
  assert.match(config, /preview_urls = true/);
  assert.doesNotMatch(config, /\[\[routes\]\]/);
  assert.match(
    config,
    /NEXT_PUBLIC_APP_URL = "https:\/\/aooi-ai-remover-preview-router\.aooi-preview\.workers\.dev"/
  );
  assert.doesNotMatch(config, /CHAT_WORKER_VERSION_ID/);
  assert.doesNotMatch(config, /CHAT_WORKER_NAME/);
  assert.match(config, /ADMIN_WORKER_NAME = "aooi-ai-remover-preview-admin"/);
});

test('buildCloudflareWranglerConfig 为 preview server worker 仍禁用 workers.dev', () => {
  const template = `
name = "public-web-template"
main = "workers/server-public-web.ts"
workers_dev = true
preview_urls = true

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "placeholder-router"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract: aiRemoverPreviewContract,
    workerSlot: 'public-web',
    templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
    outputPath: '/repo/.tmp/server/default.toml',
  });

  assert.match(config, /name = "aooi-ai-remover-preview-public-web"/);
  assert.match(config, /workers_dev = false/);
  assert.match(config, /preview_urls = false/);
  assert.doesNotMatch(config, /\[\[routes\]\]/);
  assert.doesNotMatch(config, /binding = "WORKER_SELF_REFERENCE"/);
});

test('buildCloudflareWranglerConfig 为 admin worker 注入 auth diagnostics 服务绑定', () => {
  const template = `
name = "admin-template"
main = "workers/server-admin.ts"
workers_dev = true
preview_urls = true

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'admin',
    templatePath: '/repo/cloudflare/wrangler.server-admin.toml',
    outputPath: '/repo/.tmp/admin.toml',
  });

  assert.match(config, /binding = "PUBLIC_WEB_WORKER"/);
  assert.match(
    config,
    new RegExp(
      `service = "${escapeRegExp(contract.serverWorkers['public-web'].workerName)}"`
    )
  );
  assert.match(config, /binding = "AUTH_WORKER"/);
  assert.match(
    config,
    new RegExp(
      `service = "${escapeRegExp(contract.serverWorkers.auth.workerName)}"`
    )
  );
  assert.doesNotMatch(config, /binding = "WORKER_SELF_REFERENCE"/);
});

test('buildCloudflareWranglerConfig 为 server 模板重写相对 main 与 assets 路径', () => {
  const template = `
name = "public-web-template"
main = "workers/server-public-web.ts"

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const outputPath = '/repo/.tmp/server/default.toml';
  const config = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'public-web',
    templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
    outputPath,
  });

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/cloudflare/workers/server-public-web.ts'))}"`
    )
  );
  assert.match(
    config,
    new RegExp(
      `directory = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/dist/client'))}"`
    )
  );
  assert.match(config, /localConnectionString = ""/);
  assert.match(
    config,
    new RegExp(
      `name = "${escapeRegExp(contract.serverWorkers['public-web'].workerName)}"`
    )
  );
  assert.match(config, /\[images\]\nbinding = "IMAGES"/);
  assert.doesNotMatch(config, /binding = "WORKER_SELF_REFERENCE"/);
});

test('buildCloudflareWranglerConfig 为需要 Workers AI 的 server worker 注入 [ai] binding', () => {
  const template = `
name = "public-web-template"
main = "workers/server-public-web.ts"

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract: aiRemoverContract,
    workerSlot: 'public-web',
    templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
    outputPath: '/repo/.tmp/server/default.toml',
  });

  assert.match(config, /\[ai\]\nbinding = "AI"/);
  assert.match(config, /\[images\]\nbinding = "IMAGES"/);
  assert.doesNotMatch(config, /binding = "WORKER_SELF_REFERENCE"/);

  const authConfig = buildCloudflareWranglerConfig({
    template,
    contract: aiRemoverContract,
    workerSlot: 'auth',
    templatePath: '/repo/cloudflare/wrangler.server-auth.toml',
    outputPath: '/repo/.tmp/server/auth.toml',
  });

  assert.doesNotMatch(authConfig, /\[ai\]\nbinding = "AI"/);
  assert.doesNotMatch(authConfig, /\[images\]\nbinding = "IMAGES"/);
  assert.doesNotMatch(authConfig, /binding = "WORKER_SELF_REFERENCE"/);
});

test('buildCloudflareWranglerConfig 为 Turnstile public-web 注入公开 site key', () => {
  const template = `
name = "public-web-template"
main = "workers/server-public-web.ts"

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const originalTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'turnstile-site-key';

  try {
    const config = buildCloudflareWranglerConfig({
      template,
      contract: textToSpeechContract,
      workerSlot: 'public-web',
      templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
      outputPath: '/repo/.tmp/server/default.toml',
    });
    const authConfig = buildCloudflareWranglerConfig({
      template,
      contract: textToSpeechContract,
      workerSlot: 'auth',
      templatePath: '/repo/cloudflare/wrangler.server-auth.toml',
      outputPath: '/repo/.tmp/server/auth.toml',
    });

    assert.match(
      config,
      /NEXT_PUBLIC_TURNSTILE_SITE_KEY = "turnstile-site-key"/
    );
    assert.doesNotMatch(authConfig, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  } finally {
    if (originalTurnstileSiteKey === undefined) {
      delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    } else {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    }
  }
});

test('buildCloudflareWranglerConfig 为 AI Remover public-web 注入 cleanup cron', () => {
  const template = `
name = "public-web-template"
main = "workers/server-public-web.ts"

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract: aiRemoverContract,
    workerSlot: 'public-web',
    templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
    outputPath: '/repo/.tmp/server/default.toml',
  });

  assert.match(config, /\[triggers\]\ncrons = \["17 3 \* \* \*"\]/);
  assert.doesNotMatch(config, /binding = "WORKER_SELF_REFERENCE"/);

  const authConfig = buildCloudflareWranglerConfig({
    template,
    contract: aiRemoverContract,
    workerSlot: 'auth',
    templatePath: '/repo/cloudflare/wrangler.server-auth.toml',
    outputPath: '/repo/.tmp/server/auth.toml',
  });

  assert.doesNotMatch(authConfig, /\[triggers\]/);
});

test('buildCloudflareWranglerConfig 会在已有 [dev] 段内覆盖 host 并补齐 upstream_protocol', () => {
  const template = `
name = "router-template"
main = "cloudflare/workers/router.ts"

[assets]
directory = "dist/client"

[images]
binding = "IMAGES"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[services]]
binding = "WORKER_SELF_REFERENCE"
service = "placeholder-router"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[dev]
host = "example.com"

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
PUBLIC_WEB_WORKER_NAME = ""
AUTH_WORKER_NAME = ""
PAYMENT_WORKER_NAME = ""
MEMBER_WORKER_NAME = ""
CHAT_WORKER_NAME = ""
ADMIN_WORKER_NAME = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'router',
    devHost: 'localhost',
    devUpstreamProtocol: 'http',
    templatePath: '/repo/wrangler.cloudflare.toml',
    outputPath: '/repo/.tmp/router.toml',
  });

  assert.match(
    config,
    /\[dev\]\nhost = "localhost"\n(?:\n)?upstream_protocol = "http"\n/
  );
});

test('buildCloudflareWranglerConfig 支持 state 模板且不强制要求 R2 buckets', () => {
  const template = `
name = "state-template"
main = "workers/state.ts"

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
`;

  const outputPath = '/repo/.tmp/state.toml';
  const config = buildCloudflareWranglerConfig({
    template,
    contract,
    workerSlot: 'state',
    templatePath: '/repo/cloudflare/wrangler.state.toml',
    outputPath,
    validateTemplateContract: true,
  });

  assert.match(
    config,
    new RegExp(
      `main = "${escapeRegExp(path.relative(path.dirname(outputPath), '/repo/cloudflare/workers/state.ts'))}"`
    )
  );
  assert.doesNotMatch(config, /\[\[r2_buckets\]\]/);
  assert.match(config, /STORAGE_PUBLIC_BASE_URL = ""/);
});

test('buildCloudflareWranglerConfig 为 no-DB worker 移除 Hyperdrive binding', () => {
  const template = `
name = "public-web-template"
main = "workers/server-public-web.ts"

[assets]
directory = "../dist/client"

[[r2_buckets]]
binding = "APP_STORAGE_R2_BUCKET"
bucket_name = "placeholder-storage"

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "d208cd72765b46a7b0849fc687e2fb61"
localConnectionString = ""

[[durable_objects.bindings]]
name = "STATEFUL_LIMITERS"
class_name = "StatefulLimitersDurableObject"
script_name = "placeholder-state"

[observability]
enabled = true

[vars]
DEPLOY_TARGET = "cloudflare"
NEXT_PUBLIC_APP_URL = "https://example.com"
STORAGE_PUBLIC_BASE_URL = ""
`;

  const config = buildCloudflareWranglerConfig({
    template,
    contract: mp4CompressorContract,
    workerSlot: 'public-web',
    databaseUrl: 'postgresql://unused-preview-db',
    templatePath: '/repo/cloudflare/wrangler.server-public-web.toml',
    outputPath: '/repo/.tmp/server/default.toml',
  });

  assert.doesNotMatch(config, /\[\[hyperdrive\]\]/);
  assert.doesNotMatch(config, /localConnectionString/);
});
