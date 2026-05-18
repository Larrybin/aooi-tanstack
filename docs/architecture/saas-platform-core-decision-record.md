# SaaS Platform Core Decision Record

Date: 2026-05-18

Status: accepted for staged contract audit work

## Context

`aooi` already contains reusable SaaS capabilities: site identity, auth,
billing, admin settings, product modules, credits, storage, AI provider
integration, and Cloudflare deployment contracts.

The current gap is not a total lack of platform code. The gap is that several
capabilities are still expressed as scattered implementation details or
product-specific rules instead of explicit, reusable platform contracts.

The user goal is to make new paid SaaS sites faster to build by composing
platform and commercial capabilities, while keeping the implementation realistic
for a solo vibe-coding workflow.

## Decisions

### 1. Stage One Uses Code Config Plus Admin Runtime Ops

Accepted.

Source-controlled product structure remains the primary truth source:

- `sites/<site-key>/site.config.json`
- `sites/<site-key>/pricing.json`
- `sites/<site-key>/deploy.settings.json`
- `src/config/product-modules/**`

Admin Settings is the runtime operations surface for provider mappings, safe
toggles, public config, integration settings, and operator workflows.

Admin Settings is not the full product configuration authority in stage one.

### 2. Build A Source-Mapped Contract Audit, Not A New Product Runtime

Accepted.

The first implementation target is a source-mapped audit report:

```text
existing site/pricing/deploy/module/settings contracts
  -> check-saas-product-contract
  -> section status + source refs + launch blockers/warnings
```

The audit is report-first. It should expose gaps before changing runtime
behavior, and it must not pretend unresolved sections are complete platform
contracts.

### 3. Do Not Refactor AI Remover First

Accepted.

AI Remover is useful as evidence, especially for quota reservation and generated
asset behavior. It should not be rewritten around a new platform abstraction in
stage one.

Current AI Remover product-specific code stays product-owned unless a second
real product proves the same contract.

### 4. Entitlements Sit Above Quota And Credits

Accepted.

Plans and subscriptions answer what a user may do. Quota, usage, and credits are
enforcement and metering mechanisms.

Stage one should define a controlled entitlement vocabulary and allow
product-specific keys only through explicit namespacing.

### 5. Billing Reversal Must Become Explicit After The First Skeleton

Accepted.

Refunds, cancellation, expiration, failed-job compensation, and manual operator
adjustments must be described as business events with clear effects:

- subscription state change
- entitlement revocation or downgrade
- credit grant or reversal
- usage refund
- audit record
- operator action requirement

Scattered one-off refund logic is not a complete platform contract. Billing
reversal is deferred out of the first Contract Audit Skeleton PR, then added as
a report-only audit section in PR 2. PR 2 must not implement real refund,
cancel, chargeback, or compensation runtime behavior.

### 6. Provider/Model Config Is A Later Platform Primitive

Accepted.

The platform should describe provider capabilities, required bindings/secrets,
models, cost mapping, task mode, and plan access policy.

Product prompts, masks, transforms, editors, and workflow-specific parameters
remain product code. Provider readiness is deferred out of the first Contract
Audit Skeleton PR.

### 7. Product Workflows Stay Flexible

Accepted.

Stage one does not force every SaaS product into:

```text
input -> job -> output -> access policy
```

The platform provides primitives. Product workflows can compose them.

## Rejected Options

### Universal Product Template Runtime

Rejected for stage one.

It would force abstraction before enough real products prove the workflow shape.

### Admin-First Dynamic Commercial Configuration

Rejected for stage one.

Putting pricing, entitlements, provider policy, and reversal rules directly into
Admin Settings would require draft/publish, rollback, audit, preview, cache
invalidation, and blast-radius controls. That is useful later, but too heavy for
the first platform milestone.

### Generic Quota Table Migration Now

Rejected for stage one.

AI Remover proves the reservation pattern, but a generic usage table should wait
until the contract is validated and another product confirms the shared shape.

## Stage-One Deliverables

1. Minimal contract audit types.
2. Source-mapped audit from current source-of-truth files.
3. Entitlement vocabulary and validation.
4. Site summary.
5. Commercial/pricing summary.
6. Runtime-owned field report.
7. Launch blockers and warnings.
8. CLI contract check for `SITE=ai-remover`.
9. Documentation updates.

## Guardrails

- Keep the implementation report-first.
- Keep functions and types small.
- Do not introduce plugin managers or registry classes.
- Do not create compatibility layers.
- Do not move structural commercial rules into Admin Settings yet.
- Do not change AI Remover behavior as part of the first contract PR.

## Deferred Decisions

1. Whether pricing and entitlement editing should move into Admin Draft/Publish.
2. Whether usage reservations should use a generic shared table.
3. Whether provider/model selection should become admin-editable.
4. Whether product templates should exist after the next real SaaS product.
5. Whether generated asset history should become a platform-owned module.

## Deferred Work

1. Usage and credits mapping.
2. Provider readiness report and ProviderCapabilityMatrix.
3. Runtime billing reversal implementation for refunds, chargebacks,
   compensation, and entitlement revocation.
4. Product template generator.
5. Generic quota or usage table migration.

## Next Assignment

After the first report-only contract pass, extend the same audit with Billing
Reversal Report:

```text
src/config/saas-product-contract/**
scripts/check-saas-product-contract.mjs
```

The check should run against `SITE=ai-remover` and must not change runtime
behavior.
