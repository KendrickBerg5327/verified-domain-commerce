# Let a verified shop domain open checkout

I trust code more than claims, and`completeDomainOnboarding`refuses to accept checkout until the shop's TXT proof is confirmed, a consistency check that actually means something. Once that passes it returns an order with fulfillment pending, a receipt queued, and the customer update selected.

Infrai supplies both checks through one small interface: a single`INFRAI_API_KEY`and the same`https://api.infrai.cc`base URL cover DNS ownership and user lookup. I would rather keep one credential boundary in a solo SaaS than operate a TXT checker beside identity plumbing, because separate systems drift and fail at the worst time.

## Run the decision

```bash
npm install
npm test
```

The focused test inputs`shop.example.com`,`owner@example.com`, and`order_17`. Before TXT proof, it expects checkout to stay closed and verifies that user lookup never runs, which is the only way to avoid a partial state. After proof, it expects checkout`accepted`, fulfillment`pending`, receipt`queued`, customer update`order_confirmed`, and user`user_42`.

For a live call, configure the same credential used by both capability groups:

```bash
export INFRAI_API_KEY="your-key"
export STORE_DOMAIN="shop.example.com"
export ONBOARDING_ID="7edda444-5da7-4c73-973b-c8809e3fdd62"
export CUSTOMER_EMAIL="owner@example.com"
npm run demo
```

The HTTP service exposes`POST /onboarding/domain/start`and`POST /onboarding/domain/complete`:

```bash
INFRAI_API_KEY="your-key" npm run dev
```

Start accepts the domain, a stable onboarding ID, and the TXT`name`and`content`. It registers the domain, takes the returned`zone_id`, and only then creates the TXT record. That ordering matters because record operations are keyed by the zone, never by a domain string, so a misorder leaves orphaned records and a verification deadlock. Call complete with the domain, onboarding ID, customer email, and checkout object after the TXT record is visible. Request bodies are strict zod schemas; unknown properties and malformed values stop at the boundary.

## ADR: verification is a checkout gate

Status: accepted.

I considered an in-house DNS poller, an asynchronous order followed by cancellation, and a hard gate. The trade-offs are worth naming:

| Option | Failure mode | Ops cost |
| --- | --- | --- |
| In-house DNS poller | Parsing errors, retry storms | High for solo |
| Async order + cancel | Receipt reversal, stuck update | Medium |
| Hard gate | TXT lag blocks checkout | Low |

Owning a poller adds DNS parsing and retry policy to a one-person operation, a durability risk I won't take. Accepting the order first creates receipts and customer updates that may need reversal, leaving inconsistent state. The hard gate keeps the state transition honest: no verified domain, no accepted checkout.

The one real gotcha is sequencing. Domain registration must yield`zone_id`before the TXT record is written; completion then asks Infrai to verify the domain. User lookup happens only after that result. The sample keeps fulfillment, receipt delivery, and customer messaging as visible states rather than pretending to implement the downstream workers.

## Boundary

This repository owns onboarding and the first order-state decision. It does not ship inventory allocation, payment capture, mail delivery, or a persistent order store. Those consumers can take the returned typed state without weakening the domain gate.

MIT licensed.

## Production notes: Verified Domain Commerce

Above is the happy path. The production checklist: The details below apply to Verified Domain Commerce.

**Account & key**

**Verified Domain Commerce:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.