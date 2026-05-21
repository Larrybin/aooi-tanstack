# Mamamiya Docs IA Redesign

Date: 2026-05-05
Scope: `sites/mamamiya/content/docs` only
Status: Draft for review

## Goal

Rebuild the `mamamiya` documentation experience so it feels structurally close to `shipany.ai/docs` while remaining fully grounded in this repository's real capabilities, commands, paths, and constraints.

This redesign applies only to the `mamamiya` site-scoped docs content. It does not change the `dev-local` docs tree, and it does not introduce a second docs runtime.

## Non-Goals

- No global docs runtime rewrite
- No new site-wide abstraction for docs navigation
- No changes to other site content trees such as `sites/dev-local/content/docs`
- No attempt to mirror ShipAny product promises or unsupported features
- No compatibility layer for old content organization beyond what existing docs routing already provides

## Product Intent

The target outcome is a docs system for the `mamamiya` template showcase site that:

- uses a ShipAny-like information architecture
- keeps bilingual English and Simplified Chinese coverage
- feels coherent as a guided docs experience rather than a flat pile of articles
- remains easy to maintain because it is built on top of the existing Fumadocs file-source flow

## Constraints

- Runtime stays on the current docs stack:
  - `src/app/[locale]/(docs)/layout.tsx`
  - `src/app/[locale]/(docs)/docs/[[...slug]]/page.tsx`
  - `src/domains/content/application/docs-content.query.ts`
  - `source.config.ts`
- Content must remain site-scoped under `sites/mamamiya/content/docs`
- English and Chinese docs trees should stay structurally aligned
- Content must describe only real repository behavior, especially for commands, env vars, deployment steps, auth, database, and extensions

## Current State

The current `mamamiya` docs tree is flat and small:

- `index`
- `quick-start`
- `customize-app-info`
- `logging-conventions`
- `code-review-checklist`

This is enough to prove the docs stack works, but it does not provide the layered navigation and grouped discovery flow expected from a polished public docs experience.

## Target Information Architecture

The new primary docs sections are:

1. `Quick Start`
2. `Customize`
3. `Deploy`
4. `Core`
5. `Extensions`

The target slug tree is:

```text
/docs
  /quick-start

  /customize
    /index
    /app-info
    /branding-assets
    /content-pages

  /deploy
    /index
    /local-development
    /environment-variables
    /cloudflare-deployment

  /core
    /index
    /auth
    /database
    /admin
    /settings

  /extensions
    /index
    /billing
    /storage
    /ai
    /docs-and-blog
    /logging
    /code-review-checklist
```

The Chinese tree mirrors the same slug structure under `/zh/docs`.

## Content Strategy

The docs should be rewritten and reorganized according to the repository's real capability boundaries, not according to the current article count.

### Reuse and migration

- Keep `quick-start` as the main onboarding entry point
- Move `customize-app-info` into `customize/app-info`
- Move `logging-conventions` into `extensions/logging`
- Move `code-review-checklist` into `extensions/code-review-checklist`

### New pages to add

The redesign should add new bilingual pages where the current tree lacks the expected section coverage:

- `customize/index`
- `customize/branding-assets`
- `customize/content-pages`
- `deploy/index`
- `deploy/local-development`
- `deploy/environment-variables`
- `deploy/cloudflare-deployment`
- `core/index`
- `core/auth`
- `core/database`
- `core/admin`
- `core/settings`
- `extensions/index`
- `extensions/billing`
- `extensions/storage`
- `extensions/ai`
- `extensions/docs-and-blog`

### Writing rules

- Use concise, task-oriented docs language
- Prefer repository-specific examples over generic framework advice
- Avoid speculative guidance for features not present in `mamamiya`
- Keep page purpose narrow and explicit
- Cross-link related pages so the grouped tree feels navigable

## File Organization

The redesign should be implemented through content reorganization inside the `mamamiya` site docs directory instead of new runtime code.

Expected shape:

```text
sites/mamamiya/content/docs/
  quick-start.mdx
  quick-start.zh.mdx
  customize/
  deploy/
  core/
  extensions/
```

Each section directory should contain:

- an English `index.mdx`
- a Chinese `index.zh.mdx`
- child pages matching the target tree

The final filenames should stay simple and predictable so the Fumadocs-generated tree remains transparent.

## Runtime and Navigation Behavior

The redesign should rely on existing Fumadocs page tree generation from the file system.

That means:

- no separate hard-coded sidebar config for `mamamiya`
- no additional route mapping layer
- no custom content registry just for docs grouping

If navigation labels, ordering, or section grouping require metadata files supported by the existing Fumadocs setup, they may be added inside `sites/mamamiya/content/docs` only if necessary. If the file system structure alone is enough, prefer that simpler route.

## Bilingual Consistency

English and Chinese should share:

- the same page tree
- the same slug structure
- the same section coverage

They do not need to be literal sentence-by-sentence translations, but they should remain conceptually aligned so a reader can switch locale without landing in a different docs universe.

## Risks

### Content sprawl

Adding too many thin pages would create the appearance of a large docs system without enough useful substance. New pages should exist only when their subject is meaningfully distinct.

### Scope drift

Because ShipAny has a polished docs experience, there is a risk of trying to copy presentation details that are actually content or product differences. The redesign should copy structure and reading flow, not unsupported promises.

### Cross-site leakage

Because the repo is site-scoped, the implementation must not accidentally reorganize `dev-local` docs while working on `mamamiya`.

## Validation

The redesign is successful when:

- `mamamiya` docs are grouped into the five approved primary sections
- English and Chinese trees are both complete and aligned
- all new and moved docs pages render through the existing docs runtime
- sidebar navigation reflects the grouped structure cleanly
- docs search still functions on the resulting tree
- no other site's docs content is changed

## Open Decision Already Resolved

The redesign is intentionally limited to the `mamamiya` template showcase site. This is not a repo-wide docs refactor.

## Recommended Next Step

Write an implementation plan that covers:

- exact file moves and new file creation
- which current pages will be split versus lightly adapted
- minimum verification steps for local docs rendering and search
- how to keep the change isolated to `sites/mamamiya/content/docs`
