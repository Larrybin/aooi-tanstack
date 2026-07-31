# Module Contract

This document is the single source of truth for the product module contract in `aooi`.

Use it to answer three questions:

1. Which capabilities are part of the default sellable mainline.
2. Which capabilities are optional modules you turn on later.
3. How much verification evidence exists for each path today.

## Module Matrix

| Module           | Tier       | Verification | Settings Tabs                           | Guide                                             |
| ---------------- | ---------- | ------------ | --------------------------------------- | ------------------------------------------------- |
| Core Shell       | `mainline` | `verified`   | `general`                               | [Core Shell](#core-shell)                         |
| Auth             | `mainline` | `partial`    | `auth` + supporting `email`             | [Auth guide](modules/auth.md)                     |
| Billing          | `mainline` | `partial`    | `payment`                               | [Billing guide](modules/billing.md)               |
| Admin Settings   | `mainline` | `verified`   | surface-only                            | [Admin Settings](#admin-settings)                 |
| Deploy Contract  | `mainline` | `partial`    | surface-only                            | [Deploy Contract](#deploy-contract)               |
| Docs             | `optional` | `partial`    | site capability only                    | [Docs + Blog guide](modules/docs-blog.md)         |
| Blog             | `optional` | `partial`    | site capability only                    | [Docs + Blog guide](modules/docs-blog.md)         |
| AI               | `optional` | `partial`    | `ai`                                    | [AI guide](modules/ai.md)                         |
| Storage          | `optional` | `partial`    | `storage`                               | [Storage guide](modules/storage.md)               |
| Analytics        | `optional` | `unverified` | `analytics`                             | [Growth support guide](modules/growth-support.md) |
| Affiliate        | `optional` | `unverified` | `affiliate`                             | [Growth support guide](modules/growth-support.md) |
| Customer Service | `optional` | `unverified` | `customer_service` + supporting `email` | [Growth support guide](modules/growth-support.md) |
| Ads              | `optional` | `unverified` | `ads`                                   | [Growth support guide](modules/growth-support.md) |

## Verification Rules

- `verified`: the repo has a command-level acceptance path and that command is already documented in `README.md` or `development.md`.
- `partial`: the repo has smoke / spike / unit coverage for part of the path, but not the whole operating surface.
- `unverified`: code and config entry points exist, but there is no trustworthy acceptance evidence yet.

## Core Shell

Core Shell is the default product wrapper you can ship on day one:

- public landing and pricing routes
- brand metadata and public config
- locale shell and shared UI primitives
- general settings tab as the operator-facing control point

Key routes:

- `/`
- `/pricing`
- `/sign-in`
- `/sign-up`

Primary site identity fields:

- `site.brand.appName`
- `site.brand.appUrl`
- `site.brand.logo`
- `site.brand.favicon`
- `site.brand.previewImage`
- `site.brand.supportEmail`

## Admin Settings

Admin Settings is part of the mainline because it is the operator control surface for module enablement and integration config.

Important boundary:

- Admin Settings is a configuration surface.
- It is not the truth source for module definitions.
- The product module contract lives in `src/config/product-modules/**` and is documented here.
- `settingKeys` inside that contract are derived from the admin settings registry, not hand-maintained per module.

## Deploy Contract

Deploy Contract stays in mainline because the template promise depends on one deployable, trustworthy runtime contract.

Current evidence points:

- `pnpm test:auth-spike`
- `SITE=<site-key> pnpm site:gate -- --cloudflare`

The deploy contract guide remains engineering-heavy by design. It is not an optional provider matrix.
