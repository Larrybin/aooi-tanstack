# Cloudflare OAuth Auth Spike Plan

Current repo command: `pnpm test:cf-oauth-spike`.
The landed harness injects deterministic Google + GitHub OAuth config in-process under `AUTH_SPIKE_OAUTH_CONFIG_SEED=true`, drives the real `/sign-in` social buttons, mocks only provider authorize/token/userinfo responses under `AUTH_SPIKE_OAUTH_UPSTREAM_MOCK=true`, and still exercises Better Auth callback, state validation, denial handling, session establishment, and sign-out on Cloudflare preview without mutating the local `config` table.

This plan is the next auth spike after Phase 1 email/password reached a trustworthy `PASS`.
It is intentionally separate from the email/password harness so callback, state, and provider-failure behavior can be evaluated without muddying the current signal.

## Goal

Prove whether OAuth login on Cloudflare preview is governable on its own terms.

The spike answers one question only:

> Can Cloudflare complete the governed OAuth redirect flow with correct callback, state handling, and provider-failure behavior?

## Scope

In scope:

- Cloudflare preview surface
- Google OAuth redirect login
- GitHub OAuth redirect login
- callback success path
- state mismatch / missing state handling
- provider denial / cancellation handling
- callback URL correctness
- post-login redirect correctness
- session establishment and sign-out after OAuth login

Out of scope:

- email/password coverage
- dual-runtime parity with Vercel
- One Tap
- account linking / merge UX
- provider replacement decision
- production rollout

## Why this stays separate

- Phase 1 already established that email/password is trustworthy enough to stand alone.
- OAuth has different failure modes: third-party redirect, callback origin, state validation, and provider-side denial.
- Mixing OAuth into the current harness would reduce clarity and make regression triage slower.

## Success criteria

The spike is a `PASS` only when every in-scope provider:

1. starts on Cloudflare preview from the governed sign-in page,
2. redirects to the provider with the expected callback target,
3. returns to Cloudflare preview with valid state,
4. establishes a valid session,
5. lands on the expected callback path,
6. signs out cleanly,
7. handles provider denial by landing on the final `/sign-in?...error=...` failure page, not by stopping on `/api/auth/callback/:provider`,
8. rejects tampered or missing state without creating a session.

## Failure classification

Use the same raw-conclusion vocabulary as Phase 1, but apply it to OAuth-only evidence:

| Raw conclusion | Use when                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| `PASS`         | OAuth redirect flow works on Cloudflare preview for the governed providers and failure paths.                 |
| `需要 adapter` | OAuth works, but callback/failure semantics need bounded contract normalization on the current provider path. |
| `需要替代路线` | Cloudflare cannot reliably complete the OAuth flow for a governed provider on the current path.               |
| `BLOCKED`      | The run cannot isolate OAuth feasibility because env/provider/test setup is not trustworthy.                  |

## Proposed test surface

Add one new command as the canonical OAuth spike entrypoint:

```bash
pnpm test:cf-oauth-spike
```

This command should own the entire OAuth spike.
Do not bolt OAuth cases onto `pnpm test:auth-spike`.

## Required env/config for the spike

Shared:

- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_SECRET` or `AUTH_SECRET`
- migrated database for Better Auth runtime tables
- `AUTH_SPIKE_OAUTH_CONFIG_SEED=true` so the harness injects deterministic Google/GitHub OAuth config without local DB writes
- `AUTH_SPIKE_OAUTH_UPSTREAM_MOCK=true` so the harness mocks only provider authorize/token/userinfo exchanges

Test-only callback target:

- one canonical callback path, e.g. `/settings/profile`

## Test cases

### Google OAuth

1. **google_redirect_start**
   - Start from `/sign-in`
   - Click Google login
   - Assert the real clicked button triggers the Google authorize endpoint
   - Assert callback URL points at `/api/auth/callback/google`

2. **google_callback_success**
   - Complete provider login
   - Assert redirect back to Cloudflare preview
   - Assert session exists
   - Assert final location is the governed callback path

3. **google_provider_denied**
   - Simulate provider denial/cancel
   - Assert explicit failure path
   - Assert no session is created
   - Assert no redirect loop

4. **google_state_tamper**
   - Replay callback with missing or tampered state
   - Assert request is rejected
   - Assert no session is created

### GitHub OAuth

Repeat the same four cases for GitHub:

1. `github_redirect_start`
2. `github_callback_success`
3. `github_provider_denied`
4. `github_state_tamper`

## Execution order

1. Start Cloudflare preview with `AUTH_SPIKE_OAUTH_CONFIG_SEED=true` and `AUTH_SPIKE_OAUTH_UPSTREAM_MOCK=true`.
2. Let the app surface deterministic in-memory Google/GitHub OAuth config.
3. Run Google cases.
4. Run GitHub cases.
5. Record a single Markdown/JSON report.
6. Derive one OAuth-specific raw conclusion.

## Reporting

The spike report should include:

- generated time
- commit SHA
- preview URL
- callback path
- provider configs checked
- per-provider case results
- redirect targets observed
- final session state
- raw conclusion
- failure summary
- failure screenshots

Store reports beside the existing auth-spike reports under:

```text
.gstack/projects/Larrybin-aooi/
```

## Non-goals for this plan

- No compatibility shim between email/password and OAuth harnesses
- No mixed “mega harness”
- No provider-switch recommendation unless the OAuth spike itself returns `需要替代路线`

## Exit condition

This plan is complete when the repo has:

1. one dedicated `pnpm test:cf-oauth-spike` command,
2. one OAuth-specific report format,
3. explicit coverage for callback success, denial, and state tampering for Google and GitHub.
