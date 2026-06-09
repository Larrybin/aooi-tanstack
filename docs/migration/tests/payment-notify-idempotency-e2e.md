# Payment Notify Idempotency E2E Skeleton

This is a Gate 0-3 skeleton for Codex/IT to execute in a real sandbox/test environment.
Do not run this against production data.

## Required setup

- `SITE=dev-local` or another explicit test site.
- Test database with disposable users/orders/entitlements.
- Payment provider sandbox key and webhook signing secret.
- A sandbox checkout event or provider webhook replay fixture.

## Expected behavior

1. Create or seed a pending order for the sandbox payment event.
2. Send the same valid payment notify request to `/api/payment/notify` twice.
3. The first request should process the event, update the order/subscription state, and grant entitlement/credits according to the existing aooi business logic.
4. The second request must be idempotent: it must not grant entitlement/credits a second time.
5. Verify webhook inbox/audit records show the duplicate was recognized or no-op processed according to the current aooi semantics.

## Evidence to record

- Provider event ID.
- Order ID / order number.
- Entitlement or credits value before first notify.
- Entitlement or credits value after first notify.
- Entitlement or credits value after second notify.
- HTTP status and response body for both requests.
- Database rows proving no duplicate grant occurred.

## Blocking failure

Any duplicate entitlement grant, duplicate credit issuance, or unauthenticated webhook acceptance is a blocking failure for this migration.
