---
name: payment-integration
description: Integrate payments with SePay (VietQR), Polar, Stripe, Paddle (MoR subscriptions), Creem.io (licensing). Checkout, webhooks, subscriptions, QR codes, multi-provider orders.
version: 2.2.0
license: MIT
---

# Payment Integration

Production-proven payment processing with SePay (Vietnamese banks), Polar (global SaaS), Stripe (global infrastructure), Paddle (MoR subscriptions), and Creem.io (MoR + licensing).

## When to Use

- Payment gateway integration (checkout, processing)
- Subscription management (trials, upgrades, billing)
- Webhook handling (notifications, idempotency)
- QR code payments (VietQR, NAPAS)
- Software licensing (device activation)
- Multi-provider order management
- Revenue splits and commissions

## Platform Selection

| Platform | Best For |
|----------|----------|
| **SePay** | Vietnamese market, VND, bank transfers, VietQR |
| **Polar** | Global SaaS, subscriptions, automated benefits (GitHub/Discord) |
| **Stripe** | Enterprise payments, Connect platforms, custom checkout |
| **Paddle** | MoR subscriptions, global tax compliance, churn prevention |
| **Creem.io** | MoR + licensing, revenue splits, no-code checkout |

## Quick Reference

### SePay
- `resources/sepay/overview.md` - Auth, supported banks
- `resources/sepay/api.md` - Endpoints, transactions
- `resources/sepay/webhooks.md` - Setup, verification
- `resources/sepay/sdk.md` - Node.js, PHP, Laravel
- `resources/sepay/qr-codes.md` - VietQR generation
- `resources/sepay/best-practices.md` - Production patterns

### Polar
- `resources/polar/overview.md` - Auth, MoR concept
- `resources/polar/products.md` - Pricing models
- `resources/polar/checkouts.md` - Checkout flows
- `resources/polar/subscriptions.md` - Lifecycle management
- `resources/polar/webhooks.md` - Event handling
- `resources/polar/benefits.md` - Automated delivery
- `resources/polar/sdk.md` - Multi-language SDKs
- `resources/polar/best-practices.md` - Production patterns

### Stripe
- `resources/stripe/stripe-best-practices.md` - Integration design
- `resources/stripe/stripe-sdks.md` - Server SDKs
- `resources/stripe/stripe-js.md` - Payment Element
- `resources/stripe/stripe-cli.md` - Local testing
- `resources/stripe/stripe-upgrade.md` - Version upgrades
- External: https://docs.stripe.com/llms.txt

### Paddle
- `resources/paddle/overview.md` - MoR, auth, entity IDs
- `resources/paddle/api.md` - Products, prices, transactions
- `resources/paddle/paddle-js.md` - Checkout overlay/inline
- `resources/paddle/subscriptions.md` - Trials, upgrades, pause
- `resources/paddle/webhooks.md` - SHA256 verification
- `resources/paddle/sdk.md` - Node, Python, PHP, Go
- `resources/paddle/best-practices.md` - Production patterns
- External: https://developer.paddle.com/llms.txt

### Creem.io
- `resources/creem/overview.md` - MoR, auth, global support
- `resources/creem/api.md` - Products, checkout sessions
- `resources/creem/checkouts.md` - No-code links, storefronts
- `resources/creem/subscriptions.md` - Trials, seat-based
- `resources/creem/licensing.md` - Device activation
- `resources/creem/webhooks.md` - Signature verification
- `resources/creem/sdk.md` - Next.js, Better Auth
- External: https://docs.creem.io/llms.txt

### Multi-Provider
- `resources/multi-provider-order-management-patterns.md` - Unified orders, currency conversion

### Scripts
- `scripts/sepay-webhook-verify.js` - SePay webhook verification
- `scripts/polar-webhook-verify.js` - Polar webhook verification
- `scripts/checkout-helper.js` - Checkout session generator

## Key Capabilities

| Platform | Highlights |
|----------|------------|
| **SePay** | QR/bank/cards, 44+ VN banks, webhooks, 2 req/s |
| **Polar** | MoR, subscriptions, usage billing, benefits, 300 req/min |
| **Stripe** | CheckoutSessions, Billing, Connect, Payment Element |
| **Paddle** | MoR, overlay/inline checkout, Retain (churn prevention), tax |
| **Creem.io** | MoR, licensing, revenue splits, no-code checkout |

## Implementation

See `resources/implementation-workflows.md` for step-by-step guides per platform.

**General flow:** auth → products → checkout → webhooks → events
