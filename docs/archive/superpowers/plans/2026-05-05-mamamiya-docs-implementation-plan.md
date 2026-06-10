# Mamamiya Docs IA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `sites/mamamiya/content/docs` into a bilingual ShipAny-style grouped docs tree without changing the shared docs runtime or any other site's content.

**Architecture:** Keep the existing Fumadocs runtime and route system unchanged, and perform the redesign entirely through site-scoped content reorganization under `sites/mamamiya/content/docs`. Move the current flat pages into grouped directories, add section landing pages plus missing bilingual pages, then verify generation, rendering, sidebar grouping, and search with `SITE=mamamiya`.

**Tech Stack:** Next.js App Router, Fumadocs, MDX content files, Node test runner, pnpm scripts

---

## File Structure

### Existing runtime files to read, not modify

- `source.config.ts`
- `src/app/[locale]/(docs)/layout.tsx`
- `src/app/[locale]/(docs)/layout.config.tsx`
- `src/app/[locale]/(docs)/docs/[[...slug]]/page.tsx`
- `src/domains/content/application/docs-content.query.ts`

### Existing `mamamiya` docs files to replace or move

- `sites/mamamiya/content/docs/index.mdx`
- `sites/mamamiya/content/docs/index.zh.mdx`
- `sites/mamamiya/content/docs/quick-start.mdx`
- `sites/mamamiya/content/docs/quick-start.zh.mdx`
- `sites/mamamiya/content/docs/customize-app-info.mdx`
- `sites/mamamiya/content/docs/customize-app-info.zh.mdx`
- `sites/mamamiya/content/docs/logging-conventions.mdx`
- `sites/mamamiya/content/docs/logging-conventions.zh.mdx`
- `sites/mamamiya/content/docs/code-review-checklist.mdx`
- `sites/mamamiya/content/docs/code-review-checklist.zh.mdx`

### New docs directories to create

- `sites/mamamiya/content/docs/customize/`
- `sites/mamamiya/content/docs/deploy/`
- `sites/mamamiya/content/docs/core/`
- `sites/mamamiya/content/docs/extensions/`

### New docs files to create

- `sites/mamamiya/content/docs/customize/index.mdx`
- `sites/mamamiya/content/docs/customize/index.zh.mdx`
- `sites/mamamiya/content/docs/customize/app-info.mdx`
- `sites/mamamiya/content/docs/customize/app-info.zh.mdx`
- `sites/mamamiya/content/docs/customize/branding-assets.mdx`
- `sites/mamamiya/content/docs/customize/branding-assets.zh.mdx`
- `sites/mamamiya/content/docs/customize/content-pages.mdx`
- `sites/mamamiya/content/docs/customize/content-pages.zh.mdx`
- `sites/mamamiya/content/docs/deploy/index.mdx`
- `sites/mamamiya/content/docs/deploy/index.zh.mdx`
- `sites/mamamiya/content/docs/deploy/local-development.mdx`
- `sites/mamamiya/content/docs/deploy/local-development.zh.mdx`
- `sites/mamamiya/content/docs/deploy/environment-variables.mdx`
- `sites/mamamiya/content/docs/deploy/environment-variables.zh.mdx`
- `sites/mamamiya/content/docs/deploy/cloudflare-deployment.mdx`
- `sites/mamamiya/content/docs/deploy/cloudflare-deployment.zh.mdx`
- `sites/mamamiya/content/docs/core/index.mdx`
- `sites/mamamiya/content/docs/core/index.zh.mdx`
- `sites/mamamiya/content/docs/core/auth.mdx`
- `sites/mamamiya/content/docs/core/auth.zh.mdx`
- `sites/mamamiya/content/docs/core/database.mdx`
- `sites/mamamiya/content/docs/core/database.zh.mdx`
- `sites/mamamiya/content/docs/core/admin.mdx`
- `sites/mamamiya/content/docs/core/admin.zh.mdx`
- `sites/mamamiya/content/docs/core/settings.mdx`
- `sites/mamamiya/content/docs/core/settings.zh.mdx`
- `sites/mamamiya/content/docs/extensions/index.mdx`
- `sites/mamamiya/content/docs/extensions/index.zh.mdx`
- `sites/mamamiya/content/docs/extensions/billing.mdx`
- `sites/mamamiya/content/docs/extensions/billing.zh.mdx`
- `sites/mamamiya/content/docs/extensions/storage.mdx`
- `sites/mamamiya/content/docs/extensions/storage.zh.mdx`
- `sites/mamamiya/content/docs/extensions/ai.mdx`
- `sites/mamamiya/content/docs/extensions/ai.zh.mdx`
- `sites/mamamiya/content/docs/extensions/docs-and-blog.mdx`
- `sites/mamamiya/content/docs/extensions/docs-and-blog.zh.mdx`
- `sites/mamamiya/content/docs/extensions/logging.mdx`
- `sites/mamamiya/content/docs/extensions/logging.zh.mdx`
- `sites/mamamiya/content/docs/extensions/code-review-checklist.mdx`
- `sites/mamamiya/content/docs/extensions/code-review-checklist.zh.mdx`

### Test and verification files to modify

- `tests/content-source-module.test.ts`

### New test file to create

- `src/domains/content/application/docs-content.query.test.ts`

## Task 1: Scaffold the grouped docs tree

**Files:**

- Create: `sites/mamamiya/content/docs/customize/`
- Create: `sites/mamamiya/content/docs/deploy/`
- Create: `sites/mamamiya/content/docs/core/`
- Create: `sites/mamamiya/content/docs/extensions/`
- Modify: `sites/mamamiya/content/docs/index.mdx`
- Modify: `sites/mamamiya/content/docs/index.zh.mdx`

- [ ] **Step 1: Replace the root English docs landing page with grouped navigation**

```mdx
---
title: Introduction
description: Start here to set up, customize, deploy, and extend the Mamamiya template showcase site.
---

## Start Here

- [Quick Start](./quick-start)

## Customize

- [Overview](./customize)
- [App Info](./customize/app-info)
- [Branding Assets](./customize/branding-assets)
- [Content Pages](./customize/content-pages)

## Deploy

- [Overview](./deploy)
- [Local Development](./deploy/local-development)
- [Environment Variables](./deploy/environment-variables)
- [Cloudflare Deployment](./deploy/cloudflare-deployment)

## Core

- [Overview](./core)
- [Auth](./core/auth)
- [Database](./core/database)
- [Admin](./core/admin)
- [Settings](./core/settings)

## Extensions

- [Overview](./extensions)
- [Billing](./extensions/billing)
- [Storage](./extensions/storage)
- [AI](./extensions/ai)
- [Docs and Blog](./extensions/docs-and-blog)
- [Logging](./extensions/logging)
- [Code Review Checklist](./extensions/code-review-checklist)
```

- [ ] **Step 2: Replace the root Chinese docs landing page with the same grouped navigation**

```mdx
---
title: 文档总览
description: 从这里开始配置、定制、部署并扩展 Mamamiya 模板展示站点。
---

## 开始

- [快速开始](./quick-start)

## 定制

- [概览](./customize)
- [应用信息](./customize/app-info)
- [品牌素材](./customize/branding-assets)
- [内容页面](./customize/content-pages)

## 部署

- [概览](./deploy)
- [本地开发](./deploy/local-development)
- [环境变量](./deploy/environment-variables)
- [Cloudflare 部署](./deploy/cloudflare-deployment)

## 核心能力

- [概览](./core)
- [认证](./core/auth)
- [数据库](./core/database)
- [管理后台](./core/admin)
- [设置系统](./core/settings)

## 扩展能力

- [概览](./extensions)
- [支付](./extensions/billing)
- [存储](./extensions/storage)
- [AI](./extensions/ai)
- [文档与博客](./extensions/docs-and-blog)
- [日志](./extensions/logging)
- [Code Review 清单](./extensions/code-review-checklist)
```

- [ ] **Step 3: Create the new directories and add empty tracked landing files with final frontmatter**

```mdx
---
title: Customize
description: Customize site identity, assets, and editable content for the Mamamiya site.
---
```

```mdx
---
title: 定制
description: 定制 Mamamiya 站点的身份信息、品牌素材和可编辑内容。
---
```

Use the same pattern for `deploy/index*`, `core/index*`, and `extensions/index*` with titles `Deploy`, `Core`, `Extensions` and `部署`, `核心能力`, `扩展能力`.

- [ ] **Step 4: Generate the mamamiya content source to ensure the grouped tree compiles**

Run: `SITE=mamamiya node scripts/generate-content-source-module.mjs`

Expected: stdout contains `[content] generated mamamiya:build-`

- [ ] **Step 5: Commit the scaffold**

```bash
git add sites/mamamiya/content/docs
git commit -m "docs(mamamiya): scaffold grouped docs tree"
```

## Task 2: Migrate Quick Start and create Customize section

**Files:**

- Modify: `sites/mamamiya/content/docs/quick-start.mdx`
- Modify: `sites/mamamiya/content/docs/quick-start.zh.mdx`
- Create: `sites/mamamiya/content/docs/customize/index.mdx`
- Create: `sites/mamamiya/content/docs/customize/index.zh.mdx`
- Create: `sites/mamamiya/content/docs/customize/app-info.mdx`
- Create: `sites/mamamiya/content/docs/customize/app-info.zh.mdx`
- Create: `sites/mamamiya/content/docs/customize/branding-assets.mdx`
- Create: `sites/mamamiya/content/docs/customize/branding-assets.zh.mdx`
- Create: `sites/mamamiya/content/docs/customize/content-pages.mdx`
- Create: `sites/mamamiya/content/docs/customize/content-pages.zh.mdx`
- Delete after migration: `sites/mamamiya/content/docs/customize-app-info.mdx`
- Delete after migration: `sites/mamamiya/content/docs/customize-app-info.zh.mdx`

- [ ] **Step 1: Rewrite `quick-start.mdx` to point into the new grouped docs**

Replace the "Customization" section with:

```mdx
## Next Steps

- Customize site identity: [Customize / App Info](./customize/app-info)
- Replace assets and visuals: [Customize / Branding Assets](./customize/branding-assets)
- Edit legal and landing content: [Customize / Content Pages](./customize/content-pages)
- Prepare deployment: [Deploy / Overview](./deploy)
- Learn the core systems: [Core / Overview](./core)
```

Replace the "Deploy" section with:

```mdx
## Deployment Path

- Start with [Deploy / Local Development](./deploy/local-development)
- Check required env vars in [Deploy / Environment Variables](./deploy/environment-variables)
- Follow the release flow in [Deploy / Cloudflare Deployment](./deploy/cloudflare-deployment)
```

- [ ] **Step 2: Apply the same information split to `quick-start.zh.mdx`**

```mdx
## 下一步

- 定制站点身份信息：[定制 / 应用信息](./customize/app-info)
- 替换品牌素材：[定制 / 品牌素材](./customize/branding-assets)
- 编辑法律与落地页内容：[定制 / 内容页面](./customize/content-pages)
- 准备部署：[部署 / 概览](./deploy)
- 了解核心系统：[核心能力 / 概览](./core)
```

```mdx
## 部署路径

- 从 [部署 / 本地开发](./deploy/local-development) 开始
- 在 [部署 / 环境变量](./deploy/environment-variables) 中检查必填项
- 在 [部署 / Cloudflare 部署](./deploy/cloudflare-deployment) 中完成正式发布
```

- [ ] **Step 3: Create `customize/index.mdx` and `customize/index.zh.mdx` as section landing pages**

English:

```mdx
---
title: Customize
description: Update Mamamiya branding, app identity, and public-facing content.
---

## In This Section

- [App Info](./app-info)
- [Branding Assets](./branding-assets)
- [Content Pages](./content-pages)

## What You Can Change

This section covers site identity in `sites/mamamiya/site.config.json`, public assets in `public/`, and editable page content in `sites/mamamiya/content/pages` plus locale message files.
```

Chinese:

```mdx
---
title: 定制
description: 更新 Mamamiya 的品牌信息、应用身份信息和对外展示内容。
---

## 本节包含

- [应用信息](./app-info)
- [品牌素材](./branding-assets)
- [内容页面](./content-pages)

## 你可以修改什么

本节覆盖 `sites/mamamiya/site.config.json` 中的站点身份信息、`public/` 中的公共素材，以及 `sites/mamamiya/content/pages` 和多语言消息文件中的内容。
```

- [ ] **Step 4: Split `customize-app-info` into the three new customize pages**

Use the current article as the source for:

`customize/app-info.mdx`

```mdx
---
title: App Info
description: Configure Mamamiya site identity, app URL, support email, and SEO-facing brand fields.
---

## Primary Config File

`sites/mamamiya/site.config.json`

## Fields

- `brand.appName`
- `brand.appUrl`
- `brand.supportEmail`
- `brand.logo`
- `brand.favicon`
- `brand.previewImage`

## Rules

- `brand.appUrl` must stay a pure origin
- production commands must explicitly set `SITE=mamamiya`
- `NEXT_PUBLIC_APP_URL` follows `brand.appUrl` for deployment and infra use
```

`customize/branding-assets.mdx`

```mdx
---
title: Branding Assets
description: Replace logo, favicon, preview images, and review where those assets appear in the app.
---

## Default Asset Paths

- `public/logo.png`
- `public/favicon.ico`

## Referenced By

- docs top navigation
- auth layout
- not-found page
- metadata and preview image defaults
```

`customize/content-pages.mdx`

```mdx
---
title: Content Pages
description: Update legal pages, landing copy, and locale-specific public content for Mamamiya.
---

## Main Content Paths

- `sites/mamamiya/content/pages/privacy-policy.mdx`
- `sites/mamamiya/content/pages/privacy-policy.zh.mdx`
- `sites/mamamiya/content/pages/terms-of-service.mdx`
- `sites/mamamiya/content/pages/terms-of-service.zh.mdx`
- `src/config/locale/messages/{locale}/common.json`
- `src/config/locale/messages/{locale}/landing.json`
```

Create Chinese counterparts with the same structure and translated headings.

- [ ] **Step 5: Delete the old flat customize pages and verify the site content still generates**

Run: `SITE=mamamiya node scripts/generate-content-source-module.mjs`

Expected: stdout contains `[content] generated mamamiya:build-`

Then remove:

```bash
rm sites/mamamiya/content/docs/customize-app-info.mdx
rm sites/mamamiya/content/docs/customize-app-info.zh.mdx
```

- [ ] **Step 6: Commit the quick-start and customize pass**

```bash
git add sites/mamamiya/content/docs
git commit -m "docs(mamamiya): split quick start and customize docs"
```

## Task 3: Add Deploy section pages

**Files:**

- Create: `sites/mamamiya/content/docs/deploy/index.mdx`
- Create: `sites/mamamiya/content/docs/deploy/index.zh.mdx`
- Create: `sites/mamamiya/content/docs/deploy/local-development.mdx`
- Create: `sites/mamamiya/content/docs/deploy/local-development.zh.mdx`
- Create: `sites/mamamiya/content/docs/deploy/environment-variables.mdx`
- Create: `sites/mamamiya/content/docs/deploy/environment-variables.zh.mdx`
- Create: `sites/mamamiya/content/docs/deploy/cloudflare-deployment.mdx`
- Create: `sites/mamamiya/content/docs/deploy/cloudflare-deployment.zh.mdx`

- [ ] **Step 1: Create the deploy section landing pages**

English:

```mdx
---
title: Deploy
description: Prepare Mamamiya for local development, environment setup, and Cloudflare deployment.
---

## In This Section

- [Local Development](./local-development)
- [Environment Variables](./environment-variables)
- [Cloudflare Deployment](./cloudflare-deployment)
```

Chinese:

```mdx
---
title: 部署
description: 为 Mamamiya 准备本地开发、环境变量配置和 Cloudflare 发布流程。
---

## 本节包含

- [本地开发](./local-development)
- [环境变量](./environment-variables)
- [Cloudflare 部署](./cloudflare-deployment)
```

- [ ] **Step 2: Create `deploy/local-development*` from the existing quick-start bootstrap and local setup content**

English:

````mdx
---
title: Local Development
description: Run the Mamamiya site locally with the correct site key and local environment file.
---

## Start Mamamiya Locally

```bash
SITE=mamamiya pnpm dev
```
````

## Local Defaults

- local default test site is `dev-local`
- explicit `SITE=mamamiya` is required when validating Mamamiya content
- use `.env.development` for local runtime values

````

Chinese:

```mdx
---
title: 本地开发
description: 使用正确的站点 key 和本地环境文件启动 Mamamiya。
---

## 本地启动 Mamamiya

```bash
SITE=mamamiya pnpm dev
````

````

- [ ] **Step 3: Create `deploy/environment-variables*` from the quick-start env section**

English:

```mdx
---
title: Environment Variables
description: Configure the minimum required environment variables for Mamamiya local and production runs.
---

## Required

- `DATABASE_URL`
- `AUTH_SECRET` or `BETTER_AUTH_SECRET`
- `NEXT_PUBLIC_THEME`

## Deployment Notes

- `NEXT_PUBLIC_APP_URL` must match the Mamamiya site origin
- `DATABASE_PROVIDER=postgresql`
- `DB_SINGLETON_ENABLED=true`
````

Chinese:

```mdx
---
title: 环境变量
description: 配置 Mamamiya 在本地和生产环境运行所需的最小环境变量集合。
---
```

- [ ] **Step 4: Create `deploy/cloudflare-deployment*` from the current deploy section**

English:

````mdx
---
title: Cloudflare Deployment
description: Deploy Mamamiya with the repository's tracked Cloudflare Workers workflow.
---

## Required Commands

```bash
SITE=mamamiya pnpm cf:check
SITE=mamamiya pnpm cf:build
SITE=mamamiya pnpm test:cf-local-smoke
SITE=mamamiya pnpm cf:deploy
```
````

## Required Services

- Hyperdrive
- tracked Wrangler templates
- `NEXT_INC_CACHE_R2_BUCKET`
- `APP_STORAGE_R2_BUCKET`
- `IMAGES`
- `STORAGE_PUBLIC_BASE_URL`

````

Create the Chinese page with matching command blocks and translated headings.

- [ ] **Step 5: Generate the mamamiya content source again**

Run: `SITE=mamamiya node scripts/generate-content-source-module.mjs`

Expected: stdout contains `[content] generated mamamiya:build-`

- [ ] **Step 6: Commit the deploy section**

```bash
git add sites/mamamiya/content/docs/deploy
git commit -m "docs(mamamiya): add deploy section"
````

## Task 4: Add Core section pages

**Files:**

- Create: `sites/mamamiya/content/docs/core/index.mdx`
- Create: `sites/mamamiya/content/docs/core/index.zh.mdx`
- Create: `sites/mamamiya/content/docs/core/auth.mdx`
- Create: `sites/mamamiya/content/docs/core/auth.zh.mdx`
- Create: `sites/mamamiya/content/docs/core/database.mdx`
- Create: `sites/mamamiya/content/docs/core/database.zh.mdx`
- Create: `sites/mamamiya/content/docs/core/admin.mdx`
- Create: `sites/mamamiya/content/docs/core/admin.zh.mdx`
- Create: `sites/mamamiya/content/docs/core/settings.mdx`
- Create: `sites/mamamiya/content/docs/core/settings.zh.mdx`

- [ ] **Step 1: Create the core section landing pages**

English:

```mdx
---
title: Core
description: Learn the core systems that make Mamamiya work: auth, database, admin, and settings.
---

## In This Section

- [Auth](./auth)
- [Database](./database)
- [Admin](./admin)
- [Settings](./settings)
```

Chinese:

```mdx
---
title: 核心能力
description: 了解支撑 Mamamiya 的核心系统：认证、数据库、管理后台和设置系统。
---
```

- [ ] **Step 2: Add the auth pages**

English:

```mdx
---
title: Auth
description: Understand how sign-in, auth secrets, and provider configuration work in Mamamiya.
---

## Key Files

- `src/infra/platform/auth/index.ts`
- `src/app/api/auth/[...all]/route.ts`

## What To Configure

- `AUTH_SECRET` or `BETTER_AUTH_SECRET`
- auth provider settings in `/admin/settings/auth`
```

Chinese page should mirror the same file references and config items.

- [ ] **Step 3: Add the database pages**

English:

````mdx
---
title: Database
description: Configure PostgreSQL, run migrations, and validate schema health for Mamamiya.
---

## Commands

```bash
pnpm db:migrate
pnpm db:check
pnpm db:studio
```
````

## Requirements

- PostgreSQL only
- valid `DATABASE_URL`
- Cloudflare production uses Hyperdrive

````

Chinese page should mirror the same command set and requirements.

- [ ] **Step 4: Add the admin and settings pages**

Admin page:

```mdx
---
title: Admin
description: Access the admin area, seed RBAC, and grant super admin access.
---

## Required Setup

```bash
pnpm rbac:init
pnpm rbac:assign -- --email="admin@your-domain.com" --role="super_admin"
````

````

Settings page:

```mdx
---
title: Settings
description: Configure integrations through admin settings after the app is running.
---

## Common Tabs

- `/admin/settings/auth`
- `/admin/settings/payment`
- `/admin/settings/email`
- `/admin/settings/general`
````

Create translated Chinese versions with the same command blocks and tab paths.

- [ ] **Step 5: Generate the mamamiya content source again**

Run: `SITE=mamamiya node scripts/generate-content-source-module.mjs`

Expected: stdout contains `[content] generated mamamiya:build-`

- [ ] **Step 6: Commit the core section**

```bash
git add sites/mamamiya/content/docs/core
git commit -m "docs(mamamiya): add core section"
```

## Task 5: Add Extensions section pages and migrate existing extension docs

**Files:**

- Create: `sites/mamamiya/content/docs/extensions/index.mdx`
- Create: `sites/mamamiya/content/docs/extensions/index.zh.mdx`
- Create: `sites/mamamiya/content/docs/extensions/billing.mdx`
- Create: `sites/mamamiya/content/docs/extensions/billing.zh.mdx`
- Create: `sites/mamamiya/content/docs/extensions/storage.mdx`
- Create: `sites/mamamiya/content/docs/extensions/storage.zh.mdx`
- Create: `sites/mamamiya/content/docs/extensions/ai.mdx`
- Create: `sites/mamamiya/content/docs/extensions/ai.zh.mdx`
- Create: `sites/mamamiya/content/docs/extensions/docs-and-blog.mdx`
- Create: `sites/mamamiya/content/docs/extensions/docs-and-blog.zh.mdx`
- Create: `sites/mamamiya/content/docs/extensions/logging.mdx`
- Create: `sites/mamamiya/content/docs/extensions/logging.zh.mdx`
- Create: `sites/mamamiya/content/docs/extensions/code-review-checklist.mdx`
- Create: `sites/mamamiya/content/docs/extensions/code-review-checklist.zh.mdx`
- Delete after migration: `sites/mamamiya/content/docs/logging-conventions.mdx`
- Delete after migration: `sites/mamamiya/content/docs/logging-conventions.zh.mdx`
- Delete after migration: `sites/mamamiya/content/docs/code-review-checklist.mdx`
- Delete after migration: `sites/mamamiya/content/docs/code-review-checklist.zh.mdx`

- [ ] **Step 1: Create the extensions section landing pages**

English:

```mdx
---
title: Extensions
description: Learn which optional capabilities can be enabled for Mamamiya and where each one is configured.
---

## In This Section

- [Billing](./billing)
- [Storage](./storage)
- [AI](./ai)
- [Docs and Blog](./docs-and-blog)
- [Logging](./logging)
- [Code Review Checklist](./code-review-checklist)
```

Chinese:

```mdx
---
title: 扩展能力
description: 了解 Mamamiya 可选能力的配置入口与适用范围。
---
```

- [ ] **Step 2: Add the new extension overview pages for billing, storage, AI, and docs/blog**

Billing:

```mdx
---
title: Billing
description: Configure payment providers through the repository's payment adapters and admin settings.
---

## Common Providers

- Stripe
- PayPal
- Creem

## Main Entry Points

- `/admin/settings/payment`
- `src/infra/adapters/payment/`
```

Storage:

```mdx
---
title: Storage
description: Configure Cloudflare R2 and public asset delivery for uploads and branding files.
---

## Required Pieces

- `APP_STORAGE_R2_BUCKET`
- `STORAGE_PUBLIC_BASE_URL`
- image binding configuration
```

AI:

```mdx
---
title: AI
description: Understand the repository's AI surfaces and provider-backed app routes before enabling them for Mamamiya.
---

## Main Routes

- `src/app/api/ai/`
- `src/app/[locale]/(landing)/(ai)/`
```

Docs and Blog:

```mdx
---
title: Docs and Blog
description: Manage the public docs and blog content collections for the Mamamiya site.
---

## Main Content Roots

- `sites/mamamiya/content/docs`
- `sites/mamamiya/content/posts`
```

Create Chinese counterparts with translated headings and the same path references.

- [ ] **Step 3: Move the existing logging guide into the new extension location**

Create `extensions/logging.mdx` with the current content from `logging-conventions.mdx`, but change the frontmatter to:

```mdx
---
title: Logging
description: Follow the repository's structured logging and redaction rules when extending Mamamiya.
---
```

Create `extensions/logging.zh.mdx` by moving the Chinese counterpart into the same location and aligning the title to `日志`.

- [ ] **Step 4: Move the code review checklist into the new extension location**

English:

```mdx
---
title: Code Review Checklist
description: Review pull requests for Mamamiya using the repository's practical checklist and reject criteria.
icon: ListChecks
---

This page is maintained in Chinese and linked here for navigation completeness.

- [Chinese version](./code-review-checklist)
```

````

Chinese:

Keep the current full Chinese checklist content, but move it to:

`sites/mamamiya/content/docs/extensions/code-review-checklist.zh.mdx`

and set:

```mdx
---
title: Code Review Checklist（定制版）
description: 面向 Next.js 16 + Tailwind + TypeScript 的实战 PR 审查清单。
icon: ListChecks
---
````

- [ ] **Step 5: Delete the old flat extension pages and regenerate content**

Run: `SITE=mamamiya node scripts/generate-content-source-module.mjs`

Expected: stdout contains `[content] generated mamamiya:build-`

Then remove:

```bash
rm sites/mamamiya/content/docs/logging-conventions.mdx
rm sites/mamamiya/content/docs/logging-conventions.zh.mdx
rm sites/mamamiya/content/docs/code-review-checklist.mdx
rm sites/mamamiya/content/docs/code-review-checklist.zh.mdx
```

- [ ] **Step 6: Commit the extensions section**

```bash
git add sites/mamamiya/content/docs/extensions sites/mamamiya/content/docs
git commit -m "docs(mamamiya): add extensions section"
```

## Task 6: Add content-source tests for the new Mamamiya docs tree

**Files:**

- Create: `src/domains/content/application/docs-content.query.test.ts`
- Modify: `tests/content-source-module.test.ts`

- [ ] **Step 1: Create a test that verifies the new Mamamiya docs slugs resolve**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readDocsPage,
  readDocsPageTree,
} from '@/domains/content/application/docs-content.query';

test('mamamiya docs: grouped english pages resolve', () => {
  process.env.SITE = 'mamamiya';

  assert.ok(readDocsPage({ locale: 'en', slug: ['customize', 'app-info'] }));
  assert.ok(
    readDocsPage({ locale: 'en', slug: ['deploy', 'local-development'] })
  );
  assert.ok(readDocsPage({ locale: 'en', slug: ['core', 'auth'] }));
  assert.ok(readDocsPage({ locale: 'en', slug: ['extensions', 'logging'] }));
});

test('mamamiya docs: grouped chinese pages resolve', () => {
  process.env.SITE = 'mamamiya';

  assert.ok(readDocsPage({ locale: 'zh', slug: ['customize', 'app-info'] }));
  assert.ok(
    readDocsPage({ locale: 'zh', slug: ['deploy', 'local-development'] })
  );
  assert.ok(readDocsPage({ locale: 'zh', slug: ['core', 'auth'] }));
  assert.ok(readDocsPage({ locale: 'zh', slug: ['extensions', 'logging'] }));
});

test('mamamiya docs: page tree still exists for english and chinese', () => {
  process.env.SITE = 'mamamiya';

  assert.ok(readDocsPageTree('en'));
  assert.ok(readDocsPageTree('zh'));
});
```

- [ ] **Step 2: Extend `tests/content-source-module.test.ts` to verify grouped Mamamiya docs files are present**

Add a new test:

```ts
test('@/content-source: SITE=mamamiya includes grouped docs entrypoints', async () => {
  await runGenerateContentSource('mamamiya');

  const customizePath = path.resolve(
    rootDir,
    'sites/mamamiya/content/docs/customize/index.mdx'
  );
  const corePath = path.resolve(
    rootDir,
    'sites/mamamiya/content/docs/core/index.mdx'
  );
  const extensionsPath = path.resolve(
    rootDir,
    'sites/mamamiya/content/docs/extensions/index.mdx'
  );

  assert.match(await readFile(customizePath, 'utf8'), /title: Customize/);
  assert.match(await readFile(corePath, 'utf8'), /title: Core/);
  assert.match(await readFile(extensionsPath, 'utf8'), /title: Extensions/);
});
```

- [ ] **Step 3: Run the focused automated tests**

Run:

```bash
SITE=mamamiya node --test --import tsx \
  src/domains/content/application/docs-content.query.test.ts \
  tests/content-source-module.test.ts
```

Expected: both files pass with `ok` output and no missing-doc errors

- [ ] **Step 4: Commit the docs tree tests**

```bash
git add src/domains/content/application/docs-content.query.test.ts tests/content-source-module.test.ts
git commit -m "test(mamamiya): cover grouped docs tree"
```

## Task 7: Verify rendered docs behavior for Mamamiya

**Files:**

- Modify if needed after QA: `sites/mamamiya/content/docs/**`

- [ ] **Step 1: Start the dev server for the Mamamiya site**

Run: `SITE=mamamiya pnpm dev`

Expected: Next dev server starts and serves on `http://localhost:3000`

- [ ] **Step 2: Verify the main grouped routes manually**

Open these URLs and confirm they render with grouped sidebar navigation:

```text
http://localhost:3000/docs
http://localhost:3000/docs/quick-start
http://localhost:3000/docs/customize
http://localhost:3000/docs/deploy
http://localhost:3000/docs/core
http://localhost:3000/docs/extensions
http://localhost:3000/zh/docs
http://localhost:3000/zh/docs/customize
http://localhost:3000/zh/docs/deploy
http://localhost:3000/zh/docs/core
http://localhost:3000/zh/docs/extensions
```

Expected:

- each page renders without 404
- sidebar groups match the approved tree
- English and Chinese trees are structurally aligned

- [ ] **Step 3: Verify search still indexes Mamamiya docs**

In the running browser, open docs search and confirm these queries return results:

```text
quick start
customize
deploy
auth
logging
```

Expected: at least one result per query, with links into the new grouped pages

- [ ] **Step 4: If any route or search issue appears, fix the affected content file only and rerun generation**

Run: `SITE=mamamiya node scripts/generate-content-source-module.mjs`

Expected: stdout contains `[content] generated mamamiya:build-`

- [ ] **Step 5: Commit the final content fixes after QA**

```bash
git add sites/mamamiya/content/docs
git commit -m "docs(mamamiya): polish grouped docs navigation"
```

## Self-Review

### Spec coverage

- `mamamiya` only scope: covered by every task touching only `sites/mamamiya/content/docs` plus Mamamiya-scoped verification commands
- five-section information architecture: covered by Tasks 1 through 5
- bilingual aligned tree: covered by Tasks 1 through 5 and verified in Task 7
- no runtime rewrite: preserved by file structure and task scope
- render and search validation: covered by Tasks 6 and 7

### Placeholder scan

- No `TODO`
- No `TBD`
- No "write tests later"
- Every task contains exact file paths and commands

### Type consistency

- Slugs are consistent across the plan:
  - `customize/app-info`
  - `deploy/local-development`
  - `core/auth`
  - `extensions/logging`
- Verification commands consistently use `SITE=mamamiya`

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-05-mamamiya-docs-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
