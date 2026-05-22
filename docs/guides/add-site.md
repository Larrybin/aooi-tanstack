# Add Site Runbook

这份文档说明如何在当前单仓多 site 架构中新增一个 site instance。

这里的 site 不是新的 Next.js route，也不是新的部署分支。一个 site 的最小事实源由三部分组成：

- `sites/<site-key>/site.config.json`：site identity，描述“这个站是什么”
- `sites/<site-key>/deploy.settings.json`：runtime binding contract，描述“这个站如何部署和运行”
- `sites/<site-key>/content/**`：site-scoped docs / pages / posts 内容

运行时只能通过生成的 `@/site` 读取站点身份。所有有生产语义的命令必须显式传 `SITE=<site-key>`。

## What Is Shared And What Is Site-Specific

新增 site 时，先按这张表判断改动应该落在哪里。

| Capability                 | Shared In Mainline | Per-Site Input                                                                | Usually Requires Code                  |
| -------------------------- | ------------------ | ----------------------------------------------------------------------------- | -------------------------------------- |
| App shell, locale, layout  | yes                | `site.config.json.brand.*`                                                    | no                                     |
| Shared UI system           | yes                | theme/shared components, existing layouts                                     | no                                     |
| Landing page copy/content  | yes                | `sites/<site-key>/content/pages/**` 或 locale messages                        | no                                     |
| Site/product UI            | partial            | content, locale messages, runtime settings                                    | yes when layout or interaction differs |
| One core product feature   | no                 | feature-specific route/config                                                 | yes                                    |
| Auth                       | yes                | `capabilities.auth`, auth settings, OAuth/email secrets                       | no                                     |
| Email delivery             | yes                | email settings, `RESEND_API_KEY`, sender config                               | no                                     |
| Payment                    | yes                | `capabilities.payment`, payment settings, provider secrets                    | no                                     |
| Storage/uploads            | yes                | R2 buckets, `STORAGE_PUBLIC_BASE_URL`, Cloudflare bindings                    | no                                     |
| Shared AI generator/chat   | yes                | `capabilities.ai`, AI settings, OpenRouter key                                | no                                     |
| Workers AI binding         | yes                | `bindingRequirements.bindings.workersAi`                                      | no                                     |
| Docs                       | yes                | `capabilities.docs`, `sites/<site-key>/content/docs/**`                       | no                                     |
| Blog                       | yes                | `capabilities.blog`, `sites/<site-key>/content/posts/**`                      | no                                     |
| Analytics                  | yes                | analytics settings                                                            | no                                     |
| Affiliate                  | yes                | affiliate settings                                                            | no                                     |
| Customer service widget    | yes                | customer service settings, supporting email config                            | no                                     |
| Ads                        | yes                | ads settings, provider snippets, optional `ads.txt` entry                     | no                                     |
| Cloudflare worker topology | yes                | `deploy.settings.json.workers.*`                                              | no                                     |
| Cloudflare resources       | yes                | `deploy.settings.json.resources.*`, external Cloudflare provisioned resources | no                                     |
| Secrets / runtime vars     | yes                | deploy/runtime secret and var values matching `bindingRequirements`           | no                                     |

默认判断：

- 新站的品牌、域名、模块开关、部署资源、第三方 provider key、文档、博客、营销文案，都应该通过 site config、deploy settings、runtime settings、secrets/vars 或 content 处理。
- 只有“这个站真正卖给用户的核心产品能力”才应该写代码，例如新增一个工具页、一个生成器、一个计算器、一个上传处理流程，或重做首页的信息架构。
- 如果你发现自己在为 auth、payment、email、storage、analytics 复制代码，先停下来。它们应该复用主干能力，通过配置接入。

## UI Change Rules

UI 改动按影响范围分层处理，不要把所有改动都塞进新 site 的页面里。

### Content-Only UI Changes

这些改动不应该写代码：

- 改首页标题、副标题、FAQ、feature 文案
- 改按钮文字
- 改按钮链接
- 改图片、Logo、preview image
- 改 docs / blog / pages 内容

优先修改：

- `site.config.json`
- `sites/<site-key>/content/**`
- locale messages
- admin/runtime settings

### Shared Theme UI Changes

如果改动应该影响所有 site，落在共享主题层。

当前 landing 链路：

```text
src/app/[locale]/(landing)/page.tsx
  -> src/themes/default/layouts/landing-marketing.tsx
  -> src/themes/default/pages/landing.tsx
  -> src/themes/default/pages/landing-view.tsx
  -> src/themes/default/blocks/*
```

常见改法：

- 改 section 顺序：调整 `src/themes/default/pages/landing-view.tsx` 里的 section definitions。
- 改已有 section 的结构：改 `src/themes/default/blocks/*` 对应 block。
- 改 header / footer / marketing shell：改 `src/themes/default/layouts/landing-marketing.tsx` 或对应 header/footer block。
- 改通用按钮、表单、卡片、弹窗：改 `src/shared/**` 或既有 UI primitive。

这类改动会影响所有复用该主题的 site。只有确认这是主干 UI 改进时才这样做。

### Site/Product UI Changes

如果只有某个新站需要不同页面结构、按钮位置、交互流程或产品体验，不要在共享 landing 里堆 `site.key` 分支。

优先新增明确的产品 UI：

```text
src/themes/default/pages/<product>-landing.tsx
src/domains/<feature>/ui/**
src/app/[locale]/(landing)/<feature>/page.tsx
```

适合写代码的场景：

- 首页信息架构和默认 landing 明显不同。
- CTA 位置、输入框、上传区、结果区等交互结构是这个产品的一部分。
- 新增一个工具页、生成器、计算器、转换器、编辑器或工作流。
- 某个页面需要自己的状态管理、表单校验、预览、异步任务或 API 调用。

保持原则：

- 新站独有 UI 集中在产品组件里。
- 共享 blocks 只承载可复用的通用表达。
- 不为单个 site 增加薄 wrapper、alias、兼容 fallback。
- 不把 auth、payment、email、storage 等主干能力复制到产品 UI 里。

## One-Hour Site Launch Path

目标是在一小时内把新站接到主干上，并只为核心差异写最少代码。

推荐顺序：

1. 复制一个现有 site 目录为 `sites/<new-site>`，立刻改掉 `site.config.json.key`、`domain`、`brand.*`。
2. 改 `deploy.settings.json` 的 worker 名称、bucket 名称、Hyperdrive id、operator-declared binding requirements。
3. 放入最小 content：`pages/*.mdx`，开启 docs 时加 `docs/index.mdx`，开启 blog 时加至少一个 `posts/*.mdx`。
4. 用 default settings snapshot bootstrap 后，再通过后台 settings 或 `--set` 覆盖配置 auth、email、payment、AI、analytics、customer service、ads。
5. 只在必要时新增一个核心功能 route，或者替换首页调用的产品组件。
6. 先跑 site/content/schema 相关验证，再准备本地 runtime bindings 跑 `SITE=<new-site> pnpm cf:check`。
7. 需要 Cloudflare 本地 runtime 信心时，再跑 split-worker smoke。
8. 首次 Cloudflare 上线按 state -> app -> production smoke 顺序执行。

这个流程的目的不是让每个 site 拥有一套 fork 后的应用，而是让每个 site 只拥有自己的 identity、binding、settings、content 和少量产品差异代码。

## 1. Choose The Site Key

先确定唯一的 `site-key`，例如：

```text
my-site
```

`site-key` 必须同时满足：

- 目录名是 `sites/my-site`
- `sites/my-site/site.config.json` 里的 `key` 是 `my-site`
- 本地、测试、构建、部署命令都使用 `SITE=my-site`

不要新增 alias、fallback、站点名映射表或兼容层。目录名、配置 key、命令参数必须直接一致。

## 2. Create The Site Directory

新增目录结构：

```text
sites/my-site/
sites/my-site/site.config.json
sites/my-site/deploy.settings.json
sites/my-site/content/pages/
```

`content/docs/` 只在 `capabilities.docs=true` 时必须存在。`content/posts/` 只在 `capabilities.blog=true` 时必须存在。

如果从已有 site 复制文件，复制后必须直接改成新 site 的真实值。不要保留旧 site 的历史命名。

## 3. Configure Site Identity

`site.config.json` 是 build-time site identity 的唯一事实源。

最小示例：

```json
{
  "key": "my-site",
  "domain": "example.com",
  "brand": {
    "appName": "My Site",
    "appUrl": "https://example.com",
    "supportEmail": "support@example.com",
    "logo": "/logo.png",
    "favicon": "/favicon.ico",
    "previewImage": "/logo.png"
  },
  "capabilities": {
    "auth": true,
    "payment": "none",
    "ai": false,
    "docs": true,
    "blog": true
  },
  "configVersion": 1
}
```

字段规则：

- `key` 必须和 `sites/<site-key>` 目录名一致。
- `domain` 是裸域名，不带协议。
- `brand.appUrl` 是 canonical app origin，用于 metadata、sitemap、auth callback、payment callback 等。
- `brand.logo`、`brand.favicon`、`brand.previewImage` 指向 public asset path。
- `capabilities.payment` 只能是 `none`、`stripe`、`creem`、`paypal`。
- `configVersion` 当前必须是 `1`。

## 4. Configure Deploy Settings

`deploy.settings.json` 是 repo-controlled、site-scoped、infra-only deploy manifest。
`workers` 是该 site 的 active Cloudflare topology：存在的 key 会被 build、deploy、绑定和路由；缺少的 optional key 表示该 worker 对这个 site 禁用。

最小形态：

```json
{
  "configVersion": 1,
  "bindingRequirements": {
    "bindings": {
      "workersAi": false
    },
    "secrets": {
      "authSharedSecret": true,
      "googleOauth": false,
      "githubOauth": false
    },
    "vars": {
      "storagePublicBaseUrl": true
    }
  },
  "workers": {
    "router": "my-site-router",
    "state": "my-site-state",
    "public-web": "my-site-public-web",
    "auth": "my-site-auth",
    "payment": "my-site-payment",
    "member": "my-site-member",
    "chat": "my-site-chat",
    "admin": "my-site-admin"
  },
  "resources": {
    "incrementalCacheBucket": "my-site-opennext-cache",
    "appStorageBucket": "my-site-storage",
    "hyperdriveId": "00000000000000000000000000000000"
  },
  "state": {
    "schemaVersion": 1
  }
}
```

字段规则：

- `bindingRequirements.bindings.workersAi` 表示 app server workers 是否需要 Cloudflare Workers AI `[ai] binding = "AI"`。
- `bindingRequirements.secrets.authSharedSecret`、`googleOauth`、`githubOauth` 是 operator-declared deploy requirements。
- Production email provider secret requirement 由
  `site.config.json.capabilities.auth` 派生；`CF_DEPLOY_PROFILE=preview` 不
  要求 Resend。不允许在 `deploy.settings.json` 里手写 `emailProvider`。
- OpenRouter/chat secret requirement 由 `site.config.json.capabilities.ai` 派生，不允许在 `deploy.settings.json` 里手写 `openrouter`。只使用 Workers AI binding 的产品不要打开 `capabilities.ai`。
- Payment provider secret requirement 由 `site.config.json.capabilities.payment` 派生，不允许在 `deploy.settings.json.bindingRequirements.secrets` 里手写 `stripe`、`creem` 或 `paypal`。
- `workers.router`、`workers.state`、`workers.public-web` 必填；当前不支持 pure public-web-only topology。
- `workers.auth`、`workers.payment`、`workers.member`、`workers.chat`、`workers.admin` 可选。缺少 optional worker 时，该 worker 不会被 build、deploy、service-bind、local topology 启动或要求 secrets。
- `workers.*` 必须是 Cloudflare-safe worker name；未知 worker key 会被 schema 拒绝。
- `resources.incrementalCacheBucket` 和 `resources.appStorageBucket` 必须是合法 R2 bucket name。
- `resources.hyperdriveId` 必须是真实 Cloudflare Hyperdrive id，格式是 32 位小写十六进制字符串。

不要把 auth、payment、AI、feature flags、runtime settings 或 secrets 作为顶层字段放进 `deploy.settings.json`。这些字段会被 schema 拒绝。

Payment provider secrets 不写进 `deploy.settings.json.bindingRequirements.secrets`。active provider 由 `site.config.json.capabilities.payment` 派生，Cloudflare binding resolver 会根据 `stripe`、`creem` 或 `paypal` 要求对应 runtime secrets。

`site.config.json.domain` 会派生成 router Worker 的 `[[routes]].pattern`，`cf:check` 会校验 route pattern 必须和 domain 完全一致，并且所有正式 site 的 domain 不能重复。

## 5. Add Site Content

所有 site 都必须有 `pages` content collection 目录：

```text
sites/my-site/content/pages/
```

能力开关和内容完整性必须一致：

- `capabilities.docs=true` 时，必须存在 `sites/my-site/content/docs/index.mdx`。
- `capabilities.blog=true` 时，`sites/my-site/content/posts/` 至少要有一个 `.mdx` 文件。
- `capabilities.docs=false` 时，`sites/my-site/content/docs/` 可以不存在。
- `capabilities.blog=false` 时，`sites/my-site/content/posts/` 可以不存在。

content source 会按当前 `SITE` 生成到 `.generated/content-source.ts`，运行时代码不应直接读取其他 site 的 content。

## Runtime Settings Bootstrap

新增 site 不应该靠手写零散 seed 猜测 runtime settings。先生成 default settings snapshot：

```bash
SITE=my-site pnpm exec tsx scripts/upsert-configs.ts
```

没有 `--set` 参数时，这个命令只输出默认 snapshot，不写数据库。确认后用同一入口写入默认值并覆盖站点差异：

```bash
SITE=my-site pnpm exec tsx scripts/upsert-configs.ts \
  --set=resend_sender_email=support@example.com \
  --set=general_ai_enabled=false
```

`--set` 会在写入前补齐数据库中缺失的默认 settings，但不会覆盖已有 runtime settings；只有显式传入的 `--set=<name>=<value>` 会更新对应 key。这样可以避免新站因为缺 typed settings 而在功能调用时才 503。生产值仍然以后台 settings 和受控 operator session 为准。

## Local Verification Prerequisites

`SITE=<site-key> pnpm cf:check` 不只是检查 JSON schema。它还会检查当前 site 的 active runtime binding requirements，所以需要先准备本地占位值或真实值。

| Site / Deploy Setting                                | Required Runtime Binding                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `bindingRequirements.secrets.authSharedSecret=true`  | `BETTER_AUTH_SECRET` 或 `AUTH_SECRET`                                  |
| production `capabilities.auth=true`                  | `RESEND_API_KEY`                                                       |
| `bindingRequirements.vars.storagePublicBaseUrl=true` | `STORAGE_PUBLIC_BASE_URL`                                              |
| `bindingRequirements.bindings.workersAi=true`        | Cloudflare Workers AI `[ai] binding = "AI"`                            |
| `capabilities.ai=true`                               | `OPENROUTER_API_KEY` for shared OpenRouter/chat/generator              |
| `capabilities.payment=stripe`                        | `STRIPE_PUBLISHABLE_KEY`、`STRIPE_SECRET_KEY`、`STRIPE_SIGNING_SECRET` |
| `capabilities.payment=creem`                         | `CREEM_API_KEY`、`CREEM_SIGNING_SECRET`；preview/local 缺失时只警告    |
| `capabilities.payment=paypal`                        | `PAYPAL_CLIENT_ID`、`PAYPAL_CLIENT_SECRET`、`PAYPAL_WEBHOOK_ID`        |

本地只验证配置结构时，可以先用非生产占位值跑到 `cf:check` 通过。Preview/local
缺少 `RESEND_API_KEY`、`CREEM_API_KEY`、`CREEM_SIGNING_SECRET` 时只警告并跳过本地
secret 上传；生产部署前必须在 Cloudflare 对应 worker scope 里配置真实 secret / var。

## 6. Run Local Verification

先跑最小站点选择链路：

```bash
SITE=my-site pnpm dev
```

再跑代码和架构验证：

```bash
SITE=my-site pnpm lint
SITE=my-site pnpm test
SITE=my-site pnpm lint:deps
```

准备好上面的 runtime bindings 后，再跑 Cloudflare config gate：

```bash
SITE=my-site pnpm cf:check
```

如果要验证 Cloudflare 本地 split-worker runtime：

```bash
SITE=my-site pnpm test:cf-local-smoke
SITE=my-site pnpm test:cf-admin-settings-smoke
```

这些命令会通过 `scripts/run-with-site.mjs` 生成当前 site 的 `@/site` 和 content source。不要绕过这个入口直接调用底层 Next.js、OpenNext 或 Wrangler 命令。

## Troubleshooting

| Symptom / Error Text                                              | Meaning                                                  | Fix                                                                                                                             |
| ----------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `site "<key>" is not configured`                                  | `SITE` 指向的目录缺少 `site.config.json`                 | 创建 `sites/<key>/site.config.json`，或把 `SITE` 改成已存在的 site key。                                                        |
| `site config key mismatch`                                        | 目录名和 `site.config.json.key` 不一致                   | 让 `sites/<key>`、`site.config.json.key` 和命令里的 `SITE=<key>` 完全一致。                                                     |
| `site content directory is required`                              | 缺少必需 content collection 目录                         | 至少补齐 `content/pages`；开启 docs/blog 时再补对应目录。                                                                       |
| `enables docs, but ... docs/index.mdx is missing`                 | docs 开关开启但没有 docs 首页                            | 新增 `sites/<key>/content/docs/index.mdx`，或关闭 `capabilities.docs`。                                                         |
| `enables blog, but ... posts must contain at least one .mdx file` | blog 开关开启但没有文章                                  | 新增至少一个 `sites/<key>/content/posts/*.mdx`，或关闭 `capabilities.blog`。                                                    |
| `must be a Cloudflare-safe worker name`                           | worker 名称不符合 Cloudflare 限制                        | 使用小写字母、数字和短横线，长度不超过 63，且不要以短横线开头或结尾。                                                           |
| `must be a valid R2 bucket name`                                  | R2 bucket 名称不合法                                     | 使用 3-63 位小写 bucket 名，不要用下划线、连续点或 IP 地址格式。                                                                |
| `must be a valid Hyperdrive id`                                   | Hyperdrive id 不是 32 位小写十六进制                     | 填入真实 Cloudflare Hyperdrive id，不要保留示例占位值。                                                                         |
| `duplicate site route pattern detected`                           | 两个 site 使用了同一个 `domain`                          | 为新 site 改成唯一 domain，并重新跑 `SITE=<key> pnpm cf:check`。                                                                |
| `router.routes.pattern must equal site.domain`                    | router route 与 `site.config.json.domain` 脱节           | 不要手改生成后的 Wrangler route；从 `site.config.json.domain` 重新生成并检查。                                                  |
| `requires runtime binding RESEND_API_KEY` 或类似缺 binding 报错   | production `cf:check` 找不到 active runtime secret / var | 按 Local Verification Prerequisites 准备本地 env，生产前配置 Cloudflare secret / var。Preview/local 对 Resend 和 Creem 只警告。 |

## 7. Deploy The New Site

首次初始化或部分初始化的 Cloudflare 环境，先部署 state，再部署 app：

```bash
SITE=my-site pnpm cf:deploy:state
SITE=my-site pnpm cf:deploy
SITE=my-site pnpm test:cf-app-smoke
```

如果需要 workers.dev staging runtime，不要创建 `my-site-preview` 站点。添加
`sites/my-site/deploy.preview.settings.json`，只放 preview Hyperdrive ID，然
后使用 preview profile：

```bash
SITE=my-site CF_WORKERS_DEV_SUBDOMAIN=<subdomain> CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true pnpm cf:preview:deploy:state
SITE=my-site CF_WORKERS_DEV_SUBDOMAIN=<subdomain> CF_PREVIEW_ALLOW_PLACEHOLDER_SECRETS=true pnpm cf:preview:bootstrap
SITE=my-site CF_WORKERS_DEV_SUBDOMAIN=<subdomain> pnpm cf:preview:deploy
```

部署前需要确保：

- operator 机器上的 Wrangler OAuth 已登录，并且 `pnpm exec wrangler whoami` 通过。
- Cloudflare R2 bucket、Hyperdrive、custom domain、secrets、vars 已按 `deploy.settings.json` 准备。
- 如果 `src/config/db/schema.ts` 有变化，已生成并提交对应 `src/config/db/migrations/**` 文件，并在生产部署前完成数据库迁移。

生产部署权威入口是本地 operator session，不是 GitHub branch-tip 自动发布。

## 8. Update Documentation

新增正式 site 时，至少检查这些文档是否需要同步：

- `README.md`
- `docs/architecture/site-migration-inventory.md`
- `docs/architecture/cloudflare-deployment-governance.md`
- site 自己的 `sites/<site-key>/content/docs/**`

文档要描述当前真实 contract，不保留过时施工计划。

## Boundaries

必须保持以下边界：

- site identity 只来自 `sites/<site-key>/site.config.json` 和生成的 `@/site`。
- runtime binding 只来自 env、secrets、Cloudflare bindings 和 `deploy.settings.json` 解析结果。
- runtime settings 只表示上线后可在后台修改的业务配置。

禁止事项：

- 不要从 `NEXT_PUBLIC_APP_URL`、Wrangler 模板、数据库 settings 或 request host 反推 site identity。
- 不要把 `site.brand.*` 混回 admin/runtime settings。
- 不要新增旧站点 key 的 fallback。
- 不要新增只转发字段的 wrapper、adapter、shim 或 alias。
- 不要让多个 site 共用同一组生产 Cloudflare worker / bucket 名称。

## Compatibility Decision

- Compatibility required: no.
- Thin wrappers added: none.
- Aliases preserved: none.
- Legacy branches preserved: none.

新增 site 直接接入 `sites/<site-key>` 主干结构。调用方通过 `SITE=<site-key>` 和生成的 `@/site` 进入唯一运行路径。
