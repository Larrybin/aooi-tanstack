# AI Remover MVP Documents

This directory captures the product and engineering contract for the AI Remover
MVP in this repository.

## Documents

- [Product Requirements](./product-requirements.md): MVP scope, user flows,
  pages, pricing, quota rules, and non-goals.
- [Technical Architecture](./technical-architecture.md): aooi integration,
  domain boundaries, data model, APIs, provider adapter, storage, billing, and
  security decisions.
- [Implementation Plan](./implementation-plan.md): staged delivery plan with
  the smallest useful release sequence.
- [Acceptance Checklist](./acceptance-checklist.md): product, AI job, quota,
  billing, storage, SEO, and technical verification gates.
- [Deployment Setup](./deployment-setup.md): local env, production Cloudflare
  resources, runtime secrets/vars, and Admin Settings boundaries.

## Working Assumptions

- Target site key: `ai-remover`.
- Primary product: AI Object Remover.
- First market: English.
- Payment provider: Creem.
- Storage: Cloudflare R2 through the existing aooi storage module.
- AI execution: one external image inpainting/object-removal provider through a
  small provider adapter.

## Repository Fit

AI Remover should be implemented as an aooi site/product workflow, not as a
fork of the platform modules. Reuse the existing Auth, Billing, Storage, AI,
Admin Settings, and Cloudflare deploy contract.
