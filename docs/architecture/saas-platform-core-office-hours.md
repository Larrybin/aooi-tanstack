# SaaS Platform Core Office Hours

Date: 2026-05-18

Historical office-hours note. Executable PR scopes are superseded by
`saas-platform-core-contract-implementation-plan.md`; PR 1 is limited to the
Contract Audit Skeleton, and PR 2 is limited to the report-only Billing
Reversal Audit.

## Goal

Turn `aooi` into a reusable SaaS platform base where a solo developer can launch
new paid SaaS sites by composing platform capabilities and configuring product
differences, instead of rebuilding auth, billing, quota, storage, provider, and
operator workflows per site.

This is not a request to create a universal product generator yet. The first
stage is to make the already-existing platform capabilities explicit, stable,
and reusable.

## Current Diagnosis

The first-stage capabilities are not missing. Most of them already exist in some
form:

- Site identity exists through `sites/<site-key>/site.config.json` and `@/site`.
- Auth exists through Better Auth, shared sign-in routes, OAuth settings, and
  auth runtime bindings.
- Admin Settings exists as a DB-backed operator surface with typed runtime
  readers.
- Pricing and plan content exist through `sites/<site-key>/pricing.json`.
- Billing exists through checkout, webhook inbox, order, subscription, payment
  provider adapters, and member billing surfaces.
- Product module metadata exists through `src/config/product-modules/**`.
- Credits exist as a ledger with consume and refund behavior.
- Product-specific quota reservation exists in AI Remover.

The gap is that these are not all exposed as clean platform building blocks yet.
Some are platform-level contracts; some are still product-specific or provider-
specific implementations.

The practical question is therefore:

> Which existing implementations should be promoted into explicit platform
> contracts, and which should remain product-specific?

## Premises

1. The first platform milestone should productize existing core capabilities,
   not invent a broad plugin system.
2. New SaaS sites should keep static site identity and deploy resources in
   `sites/<site-key>/**`.
3. Runtime Admin Settings should control operational values and safe toggles,
   not replace all source-controlled product configuration on day one.
4. Entitlements must sit above quota and credits. A plan says what a user may
   do; quota and credits enforce or meter it.
5. Refund, reversal, and compensation must be explicit business contracts, not
   scattered one-off error handling.
6. Product workflows may differ. The platform should first provide primitives:
   auth, billing, entitlements, usage, credits, storage, provider config, admin
   settings.

## Capability Audit

| Capability              | Current State    | Platform Gap                                                                                                |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Site Identity           | Strong           | Need clearer new-site required field checklist.                                                             |
| Auth                    | Strong           | Need one operator checklist for login modes and provider prerequisites.                                     |
| Admin Settings          | Strong           | Need module readiness projection tied to launch gates.                                                      |
| Pricing / Plans         | Partial platform | Pricing JSON exists, but plan semantics are not a typed platform contract.                                  |
| Billing                 | Strong           | Checkout/webhook/subscription exist; reversal/refund policy needs a first-class contract.                   |
| Entitlements            | Partial          | Pricing entitlements are raw key/value maps; product-specific resolvers interpret them.                     |
| Quota / Usage           | Partial          | Generic credits exist; AI Remover quota reservation is product-specific.                                    |
| Credits                 | Partial          | Consume/refund exists; manual compensation UI/write flow is not a complete operator primitive.              |
| Refund / Compensation   | Partial          | Failed AI task refunds exist in specific paths; payment refunds and entitlement reversal need one contract. |
| Provider / Model Config | Partial          | Provider adapters exist, but admin-facing provider capability matrix is not first-class.                    |
| Storage / Assets        | Partial          | Storage module exists; generated asset lifecycle/history is still product-specific.                         |

## Three Possible Routes

### Route A: Platform Core Contracts

Promote existing implementations into explicit contracts:

- Entitlement contract
- Usage reservation contract
- Billing reversal contract
- Compensation contract
- Provider capability contract

This is the recommended route. It keeps the codebase simple and turns real
working paths into reusable building blocks.

### Route B: Product Template Runtime

Create a product template system where new SaaS sites declare workflow type,
inputs, outputs, provider, quotas, and pages.

This is too early. It will force abstraction before a second product proves the
shape.

### Route C: Admin-First Dynamic Platform

Move plans, entitlements, provider selection, quotas, and product behavior into
Admin Settings immediately.

This is too much operational complexity for solo development. Admin Settings
should first manage safe runtime values and observability; source-controlled
product configuration should remain the default for structural decisions.

## Recommended First Stage

First stage name:

> SaaS Platform Core Contract

Scope:

1. Document the platform capability model as the source of product decisions.
2. Define a typed entitlement contract shared by products.
3. Define a generic usage reservation lifecycle:
   `reserve -> commit -> refund -> expire`.
4. Define how credits relate to entitlements and usage.
5. Define billing reversal behavior:
   payment refund, subscription cancel, subscription expire, manual operator
   compensation.
6. Define provider/model configuration as a capability matrix, but do not build
   a full provider marketplace.
7. Define launch-readiness gates for a new paid SaaS site.

Non-goals:

- Do not build a universal AI workflow engine.
- Do not make every product flow use `input -> job -> output -> access policy`.
- Do not move all pricing and entitlement editing into Admin Settings yet.
- Do not rewrite AI Remover around new abstractions in the first step.
- Do not add compatibility layers around current product-specific code.

## Target Building Blocks

### 1. Site Contract

Required for every new SaaS site:

- site key
- app name
- app URL
- support email
- logo / favicon / preview image
- enabled capabilities
- deploy settings
- pricing file if billing is enabled

### 2. Commercial Contract

Required for paid SaaS:

- plan id
- provider product mapping
- billing interval
- checkout eligibility
- entitlement keys
- subscription status interpretation
- cancellation and refund behavior

### 3. Entitlement Contract

Entitlements should answer:

- What can this actor do?
- How much can they do?
- In what time window?
- What size / retention / access limits apply?
- Which provider/model tier can they use?

Raw pricing JSON can continue to store values, but products should not invent
their own entitlement interpretation each time.

### 4. Usage Contract

Usage should support:

- anonymous and signed-in actors
- idempotent reservation
- commit on success
- refund on failure
- expiration
- daily/monthly/lifetime windows
- operator-readable ledger/audit records

AI Remover already proves the reservation pattern. The platform gap is making it
generic without forcing all products into the same workflow.

### 5. Credits Contract

Credits should support:

- grant
- consume
- refund consumed credits
- expiration
- transaction scene
- metadata
- admin list and manual compensation

The existing credit ledger is close, but the operator compensation path should be
made explicit before calling it a complete platform primitive.

### 6. Billing Reversal Contract

Every payment-related reversal needs an explicit effect:

- payment refunded
- subscription canceled
- subscription expired
- subscription renewed
- chargeback or provider dispute
- manual compensation

Each event should state whether it:

- revokes entitlement
- changes subscription state
- refunds usage or credits
- writes audit records
- requires operator action

### 7. Provider Capability Contract

Provider/model config should describe:

- provider name
- supported media/input/output type
- sync or async behavior
- required bindings/secrets
- default model
- model parameters
- fallback behavior
- cost mapping
- which plans may use it

This is a platform primitive. Product prompts, masks, transforms, and UI remain
product-specific.

## First Decision

The first implementation plan should not start with AI Remover refactoring.

It should start with a repo-grounded contract audit:

1. Mark which first-stage capabilities are already platform-ready.
2. Mark which are partial and need contract work.
3. Mark which are product-specific and should stay that way.
4. Produce a minimal implementation plan for the missing contracts.

## Open Questions

1. Should plan and entitlement editing stay in source-controlled pricing JSON for
   now, or should Admin Settings get a limited operator editor?
2. Should usage reservation become a generic table now, or should the current
   product-specific tables remain until the second product appears?
3. What is the minimum admin compensation action required for launch: grant
   credits only, or grant/revoke/refund with audit notes?
4. Should provider/model selection be deploy-time config first, Admin Settings
   later, or both from the start?

## Assignment

Before any code refactor, produce one concrete implementation plan:

> SaaS Platform Core Contract Implementation Plan

It should be limited to platform contracts and launch-readiness gates. It should
not redesign AI Remover, and it should not introduce product-template generation
yet.
