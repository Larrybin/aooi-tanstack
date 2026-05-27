---
name: i18n-review
description: Use when reviewing aooi pending localized pages, checking glossary/fallback/SEO readiness, preparing approval reports, or changing manifest entries from pending to approved only after explicit user confirmation.
metadata:
  short-description: Review and approve aooi i18n pages
---

# Aooi I18n Review

Use this skill only in the `aooi` repository when the user asks to review localized content, inspect pending i18n work, or approve specific localized pages.

## Guardrails

- AI-generated content is not approved by default.
- Do not change `manifest.json` status to `approved` unless the user explicitly confirms the exact locale/page list.
- Before writing approval changes, show the actual entries that will become `approved`.
- Do not bulk approve ambiguous scopes such as "all good" unless the pending page list has been shown and the user confirms it.
- `dev-local` and `mamamiya` are legacy/optional rollout sites. `ai-remover`, `background-remover`, and future non-legacy sites are rollout-required.

## Workflow

1. Resolve scope:
   - Confirm `site-key`, locale(s), and page id(s).
   - Read `site.config.json`, `pages.json`, `manifest.json`, glossaries, and `.reports/i18n/<site-key>/latest.json` if it exists.
2. Refresh checks:
   - Run `pnpm i18n:schema:check`.
   - Run `pnpm i18n:glossary:check`.
   - Run `pnpm i18n:check --site <site-key>` before reviewing pending entries.
   - Keep strict mode for post-approval verification because rollout-required sites fail strict checks while manifest entries are still pending or rejected.
3. Review content:
   - Compare the English source asset with the target-language asset.
   - Check page completeness, metadata, H1, CTA, FAQ, body copy, glossary terms, forbidden claims, and English residuals according to page type.
   - For SEO/blog/docs, evaluate against the user-provided brief when available. If no brief is available, mark SEO intent as not verified.
4. Report:
   - List each reviewed `locale/pageId` with `approve`, `needs changes`, or `not reviewed`.
   - Include blocking errors, warnings, and any SEO-brief gaps.
   - Do not edit approval status while producing a report-only review.
5. Approve only after explicit confirmation:
   - Reprint the exact `locale/pageId/path` entries to approve.
   - Update only those manifest entries from `pending` to `approved`.
   - Keep `sourceHash` and `targetHash` unchanged unless the reviewed content changed in the same fix.
   - Re-run `pnpm i18n:check --site <site-key>` after partial approvals.
   - Run `pnpm i18n:check --site <site-key> --strict` only when no manifest entries remain pending or rejected for rollout-required locales.

## Completion Standard

Finish with:

- Reviewed site, locales, and pages.
- Manifest statuses changed, if any.
- Checks run and outcomes.
- Pages left pending or rejected.
- Any SEO brief or human-review gaps that CI cannot validate.
