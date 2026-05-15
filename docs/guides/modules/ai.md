# AI Module

## What This Module Does

AI is an optional product module layered on top of the mainline shell:

- AI generator routes such as `/ai-chatbot`
- provider-specific task execution
- AI webhook notify endpoints

## Required Configuration

- `general_ai_enabled`
- provider API keys in the `ai` settings tab

## External Services

- Cloudflare Workers AI
- OpenRouter
- Replicate
- Fal
- Kie

## Credit Refund Boundary

- Failed task refunds are handled in AI application/API orchestration before the task status update is written.
- Normal AI task updates must not pass `creditId`; the infra update fallback is transitional protection for stale untyped callers only.

## Minimum Verification Commands

- `pnpm test`
- `pnpm test:cf-app-smoke`
- AI Remover Workers AI runtime spike:
  `SITE=ai-remover pnpm test:remover-workers-ai-spike`

## Common Failure Modes

- Public nav hides AI correctly, but APIs still leak when the module is disabled.
- Provider credentials are saved, but the selected provider path is not fully validated.
- Credits or billing assumptions are unclear when AI is enabled before billing is configured.

## Product Impact If Disabled

The default shell still runs, but AI product surfaces and related APIs should disappear cleanly.
