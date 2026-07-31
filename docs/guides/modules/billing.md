# Billing Module

## What This Module Does

Billing covers the commercial mainline:

- pricing surface
- checkout session creation
- webhook handling
- subscription and credit-related purchase flows

## Required Configuration

- `site.capabilities.enabledModules` entry `billing`
- `site.capabilities.paymentProvider`
- provider-specific secrets for the active capability
- active provider settings under the `payment` tab

## External Services

- Stripe
- Creem
- PayPal

## Minimum Verification Commands

- `pnpm test:creem-webhook-spike`
- `pnpm test`

## Common Failure Modes

- Checkout renders but webhook verification is misconfigured.
- Product ID mapping drifts from pricing config.
- Site declares a payment capability without the required provider secrets.

## Product Impact If Disabled

The template can no longer sell plans, credits, or subscriptions through the billing path for the current site.
