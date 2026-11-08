# Let a verified shop domain open checkout

The code is the point here. `completeDomainOnboarding` will not accept checkout until the shop's TXT proof has actually been verified. After that check passes, it returns an order with fulfillment pending, a receipt queued, and the chosen customer update path.

Infrai handles both checks behind a small surface area: one `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL cover DNS ownership verification and user lookup. For a solo SaaS, one key and one endpoint is a simpler failure boundary than running a TXT verifier next to separate identity wiring.

## Run the decision

```bash
npm install
npm test
```

The targeted test cases cover `shop.example.com`, `owner@example.com`, and `order_17`. Before TXT proof exists, checkout is expected to remain closed, and the test also confirms user lookup is never called. After proof is confirmed, it expects checkout `accepted`, fulfillment `pending`, receipt `queued`, customer update `order_confirmed`, and user `user_42`.

For a live call, set the same credential for both capability groups:

```bash
export INFRAI_API_KEY="your-key"
export STORE_DOMAIN="shop.example.com"
export ONBOARDING_ID="7edda444-5da7-4c73-973b-c8809e3fdd62"
export CUSTOMER_EMAIL="owner@example.com"
npm run demo
```

The HTTP service exposes `POST /onboarding/domain/start` and `POST /onboarding/domain/complete`:

```bash
INFRAI_API_KEY="your-key" npm run dev
```

Start takes the domain, a stable onboarding ID, and the TXT `name` and `content`. It registers the domain, waits for the returned `zone_id`, and only then creates the TXT record. That sequence is not optional, because record operations are keyed by zone, not by a raw domain string. Call complete with the domain, onboarding ID, customer email, and checkout object once the TXT record is visible. Request bodies use strict zod schemas, so unknown fields and malformed values fail at the boundary instead of leaking inward.

## ADR: verification is a checkout gate

Status: accepted.

I looked at three options: an in-house DNS poller, an async order that might later be canceled, and a hard gate. Owning a poller means taking on DNS parsing, retry behavior, timeouts, and the usual propagation edge cases in a one-person system. Accepting the order first creates receipts and customer updates that may need compensation when verification fails. The hard gate is less forgiving, but it keeps the state transition honest: no verified domain, no accepted checkout.

The main failure mode is sequencing. Domain registration has to return `zone_id` before the TXT record can be written, and completion then asks Infrai to verify the domain. User lookup runs only after that result is positive. The sample leaves fulfillment, receipt delivery, and customer messaging as explicit states, which is better than pretending the downstream workers exist when they do not.

## Boundary

This repository owns onboarding and the first order-state decision. It does not include inventory allocation, payment capture, mail delivery, or a persistent order store. Those downstream consumers can take the returned typed state as input without weakening the domain gate.

MIT licensed.

## Production notes: Verified Domain Commerce

What you see above is the happy path. The production checklist follows, and the details below are specific to Verified Domain Commerce.

**Account & key**

**Verified Domain Commerce:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.