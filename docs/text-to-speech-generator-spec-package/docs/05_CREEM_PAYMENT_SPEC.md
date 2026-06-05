# Creem Payment Spec

## Provider

Creem.

## Product Types

- Lifetime Basic: one-time payment
- Lifetime Pro: one-time payment
- Extra Credits: one-time payment

## Checkout Flow

1. User clicks plan or credit package.
2. App creates or requests Creem checkout session.
3. User completes payment on Creem checkout.
4. Creem redirects user back to app.
5. Webhook confirms payment.
6. App grants entitlement or credits.

## Webhook Rules

- Verify `creem-signature`.
- Process events idempotently.
- Persist event ID.
- Do not grant entitlement twice.
- Handle refunds.
- Map order/customer to aooi user.

## Refund Rules

Lifetime refund:

- revoke plan entitlement or downgrade to Free.
- stop future monthly quota grants for that lifetime plan.

Extra Credits refund:

- remove unused credits from the relevant lot.
- if already consumed, create negative adjustment or flag account for manual review.

## Required Config

- Creem API keys / webhook secret
- Lifetime Basic product ID
- Lifetime Pro product ID
- Extra Credits product ID
- success URL
- cancel URL
