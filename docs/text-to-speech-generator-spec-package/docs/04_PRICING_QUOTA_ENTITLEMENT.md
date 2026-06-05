# Pricing, Quota, and Entitlement Spec

## Plans

| Plan           |        Price |       Monthly quota | Single request limit | History |  Audio retention |
| -------------- | -----------: | ------------------: | -------------------: | ------: | ---------------: |
| Free           |           $0 |  10,000 chars/month |          3,500 chars |       3 |           3 days |
| Lifetime Basic | $29 one-time | 100,000 chars/month |         15,000 chars |      20 |          30 days |
| Lifetime Pro   | $79 one-time | 500,000 chars/month |         15,000 chars |      50 |          90 days |
| Extra Credits  |           $9 |       250,000 chars |                  N/A |     N/A | 12 months expiry |

## Guest Preview

- 1,500 characters per generation
- 5 generations per IP/day
- Turnstile required
- No MP3 download

## Entitlement Rules

- Free users get monthly quota after registration.
- Lifetime Basic and Lifetime Pro are one-time purchases.
- Lifetime plans are not unlimited.
- Extra Credits are consumed only after monthly quota is exhausted.

## Monthly Reset

Monthly quota resets every calendar month or rolling monthly billing period, depending on aooi's existing entitlement model. The SPEC accepts either, but the UI must clearly show reset date.

## Extra Credits Expiry

- Valid for 365 days after purchase.
- UI must show expiration.
- Ledger must support expiry.

## Charging Rules

- Generate charges.
- Replay does not charge.
- Download does not charge.
- Matching unexpired request hash can reuse audio without charging.
- Failed generation must not charge.
