---
name: i18n-localize
description: Use when generating or updating aooi site-level localized content from English source assets; follows site.config.json, pages.json, glossary, SEO brief input, manifest pending status, and i18n checks without approving content.
metadata:
  short-description: Generate pending aooi localized content
---

# Aooi I18n Localize

Use this skill only in the `aooi` repository when the user asks to generate or update localized content for a site.

## Guardrails

- English is the only source language.
- Do not call external translation APIs unless the user explicitly asks.
- Do not invent SEO keyword research. For SEO, blog, or docs pages, use the user's pasted brief. If no brief is provided, ask for it or get explicit permission to continue without SEO-intent validation.
- Never write `approved`. Generated or changed target-language content must enter `manifest.json` as `pending`.
- Only use locales declared in `sites/<site-key>/site.config.json`.
- `dev-local` and `mamamiya` are legacy/optional rollout sites. `ai-remover`, `background-remover`, and future non-legacy sites are rollout-required.

## Workflow

1. Resolve scope:
   - Confirm `site-key`, target locale(s), and page id(s).
   - Read `sites/<site-key>/site.config.json`, `sites/<site-key>/i18n/pages.json`, `sites/<site-key>/i18n/manifest.json`, and both glossaries.
   - Reject unsupported locales instead of adding ad hoc locale folders.
2. Read source assets from each page registry entry:
   - `site-content`: `sites/<site-key>/<source.path>`.
   - `locale-messages`: `src/config/locale/messages/en/**`.
   - `app-route`: inspect the referenced route and the content assets it uses.
3. Generate target content:
   - SEO/blog/docs: localize for the target market and user-provided brief, not a sentence-by-sentence translation.
   - Product UI/auth/admin/legal: keep meaning accurate, preserve glossary terms, and avoid English fallback.
   - Preserve only terms allowed by the global or site glossary.
4. Update the manifest:
   - Add or replace only the selected `locales[locale][pageId]` entries.
   - Set `status` to `pending`.
   - Set `path` equal to the page registry path.
   - Set `sourceHash` and `targetHash` from the current source and target user-visible assets. Until a narrower extractor exists, use a deterministic SHA-256 hash of the relevant source/target file content and state that scope in the final summary.
5. Verify:
   - Run `pnpm i18n:schema:check`.
   - Run `pnpm i18n:glossary:check`.
   - Run `pnpm i18n:check --site <site-key>`.
   - Do not require strict mode to pass after creating pending entries; rollout-required sites intentionally fail strict checks for pending manifest entries.
   - Run the narrowest relevant tests for touched scripts or content contracts.

## PR Behavior

When publishing localized content:

- Create a Draft PR unless the user explicitly asks otherwise.
- Add or request the `i18n-pending-review` label.
- Summarize generated pages, locales, brief coverage, manifest entries changed, checks run, and remaining warnings.
- Do not mark content approved in the same localization pass.
