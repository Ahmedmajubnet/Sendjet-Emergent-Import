# Production hardening and release gate

No deployment or database migration is performed by these changes. Do not switch
production traffic until configuration, a read-only legacy audit, and a staging
smoke test have been reviewed. Preserve the existing production SECRET_KEY: changing
it invalidates login/email tokens and stored confirmation-code hashes.

## Environment

| Variable | Production requirement |
| --- | --- |
| APP_ENV | `production`; other allowed values are `development`, `preview` (default: development) |
| SECRET_KEY | Explicit secret; absent/known fallback values abort startup in all environments |
| MONGO_URL, DB_NAME | Existing database, supplied securely; no drop/recreation required |
| SENDJET_STRIPE_KEY | Stripe live secret key; preferred canonical name |
| STRIPE_API_KEY | Legacy alias only; conflicting nonempty aliases abort startup |
| STRIPE_WEBHOOK_SECRET | Signing secret for the production `/api/webhook/stripe` endpoint; required in production |
| PUBLIC_SITE_URL | Explicit HTTPS frontend origin, e.g. `https://sendjet.de`; used for checkout and email links |
| CORS_ORIGINS | Comma-separated HTTPS origins including PUBLIC_SITE_URL; no wildcard |
| ENABLE_DEMO_DATA | `true` by default to preserve the early marketplace; `false` disables demo seeding/refresh |
| ALLOW_LIVE_STRIPE | Leave unset/false; only `true` deliberately permits live keys in development/preview |
| RESEND_API_KEY | Required operationally for verification and pickup/delivery email delivery |
| EMAIL_FROM, EMAIL_REPLY_TO | Verified sending identity and reply address; do not set to empty strings |
| REACT_APP_BACKEND_URL | Frontend build-time backend origin (no `/api` suffix), e.g. `https://sendjet.de` when proxied on the same host |

Production rejects missing/live-mismatched Stripe configuration before constructing
the Mongo client. Development/preview defaults use localhost for site/CORS and reject
live Stripe unless explicitly allowed. Stripe response/event `livemode` is checked,
so data from the other mode cannot be reconciled. Configure the actual Stripe
endpoint to send `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`. Endpoint
registration is an operator step, never an automatic application startup mutation.

## Startup and demos

The only startup database operation is optional demo seeding/refresh. Removed:
notification timestamp migration, real listing expiration writes, role/verification
rewrites, admin auto-verification, transport inference, legacy system-user deletion,
and global shipment-photo removal. None was retained as an automatic migration.
Read-time listing filters still determine marketplace availability. Legacy roles
remain readable strings; admins retain their existing role and verification state.

Seeding creates up to 24 marked users, 12 trips, and 12 shipments. Every record has
`is_demo: true`, `seed_version: 3`, and a deterministic `_id`/`id`. IDs stay constant
across restarts and versions. Mongo's `_id` uniqueness plus `$setOnInsert` prevents
duplicate seeding across workers without adding indexes to real collections.
Existing documents are not rewritten or deleted. A non-demo identity collision is
skipped; an email collision with another record also skips that persona/listing.
Email domains never establish demo ownership. Historical unmarked demo records
remain untouched; any adoption/removal requires separate evidence and approval.

Startup and marketplace reads (throttled to five minutes per worker) roll overdue, explicitly marked, available/expired
demo listings seven days forward (end date one day later). They skip completed,
cancelled, assigned, or match-referenced listings. Updates repeat marker, state,
assignment, and original-date predicates. No delete/rebuild and no real-record
refresh occurs. Demo accounts/listings remain sample content, with no invented
private recipient details or automatic booking fulfillment.

## Checkout safety

`checkout_attempts` uses match ID as its unique `_id`. The initial upsert persists
one attempt UUID, immutable amount/metadata/redirect parameters, environment mode,
and creation time. Stripe POST requests use
`sendjet-checkout:<match-id>:<attempt-id>` as the idempotency key. Multiple workers
use the same key/parameters; Stripe conflict responses retry that same request.
New payment transactions also use a unique deterministic `_id` per session.

Known sessions are retrieved and reused only while open and unpaid. Stripe-paid
sessions reconcile through the existing confirmation flow. Complete/processing
sessions block another checkout. For journey-linked bookings, a Stripe-confirmed
expired/unpaid session cancels the reservation; a new request must reserve capacity
again. Ambiguous historical attempts stay blocked for reconciliation. Legacy
bookings without a journey retain their existing expired-session rotation behavior.
Provider failures do not rotate the key.
If a create response was lost, the same persisted attempt recovers it. Unknown
outcomes older than 23 hours block for operator reconciliation because Stripe may
prune idempotency keys after 24 hours. Multiple pre-hardening transactions block
checkout for review rather than guessing which old session is payable. Paid or
otherwise non-payable matches cannot create another session.

Pay Now has an immediate ref guard plus disabled/loading state. Redirect hosts
come exclusively from PUBLIC_SITE_URL, not the submitted browser origin.
Amounts, currency, metadata, and mode are checked before payment reconciliation.

## Journey capacity

Stored `available_weight` (kg) and `available_space` (litres) remain the offered
totals. `capacity_size` is descriptive; it is not an additional capacity counter.
Acceptance snapshots shipment weight and dimensions (cm3 converted to litres) in
`capacity_claims` on the journey. A `capacity_revision` compare-and-set serializes
claims across workers before the shipment is assigned or checkout is started.
No replica set, startup migration, or production-data rewrite is required.

Marketplace and match-option reads subtract accepted/payment_pending/paid/
in_progress/completed allocations, including legacy matches without snapshots.
They expose remaining capacity only for future `active` journeys; exhausted or
unknown legacy capacity is hidden. Missing/zero legacy volume means an unspecified
volume limit, so only weight is enforced on those records. Invalid weights or
shipment dimensions require reconciliation rather than invented capacity.

Both parties can cancel accepted bookings before checkout; the requester can
cancel a pending request. Checkout claims payment_pending before provider calls,
preventing a simultaneous cancellation. Started/unknown payments remain reserved;
verified Stripe expiration (webhook, status polling, or checkout retry) releases
only an unambiguous expired/unpaid reservation. No arbitrary local timer frees a
potentially payable booking. Accepted requests without checkout remain reserved
until cancelled. Delivery/completion never releases capacity for the same journey.
Snapshots preserve consumption after a delivered shipment is deleted. An interrupted
acceptance can conservatively retain a claim until its request is cancelled/rejected.

Journey cancellation retains its record and is blocked while claims/bookings remain.
The old conversation booking route now requires a journey and creates a normal
request instead of bypassing acceptance. Existing journey-less bookings are not
silently assigned to an inferred journey or migrated.

## Verified webhooks

Inspected `emergentintegrations==0.2.1` wheel, specifically
`emergentintegrations/payments/stripe/checkout.py`. Its `handle_webhook` calls
`json.loads` without verification when `webhook_secret` is absent. The old SendJet
constructor supplied only `api_key` and `webhook_url`, so that unsigned path was
reachable. The new payment boundary no longer calls this integration, and its now
unused dependency was removed. The already-pinned official Stripe SDK remains.

`stripe.Webhook.construct_event(raw_bytes, signature, STRIPE_WEBHOOK_SECRET,
tolerance=300)` verifies signatures before database access. Missing secret returns
503; missing/invalid/stale signature or wrong event mode returns 400. Accepted
events trigger an authenticated Stripe Session retrieval; amount, currency and
booking identity are checked before the existing idempotent reconciliation runs.
A webhook racing the transaction write receives 503 for retry. Provider errors
are generic and never log bodies, signatures, keys, or Stripe objects.

References: [Stripe SDK webhook example](https://github.com/stripe/stripe-python/blob/master/examples/webhooks.py),
[Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests).

## Read-only legacy audit

Set `SENDJET_AUDIT_MONGO_URL` securely to a Mongo principal with only the database
`read` role. The script deliberately does not load `.env`, import `server`, or use
the application's MONGO_URL implicitly. Run only with explicit operator approval:

```powershell
python backend/scripts/audit_legacy_bookings.py --database <database-name>
```

Output is JSON with match/shipment IDs, statuses, fixed reason codes, affected
counts, and category totals. It checks private recipient presence without outputting
it; confirmation presence and handover evidence; assignment/traveler/trip consistency;
shipment/match/payment state consistency; multiple historical payment attempts;
and unresolved checkout outcomes older than the safe idempotency retry window.
It uses only `find`/`find_one`. No writes, indexes, updates, drops, repairs, email,
or Stripe calls. It has not been run against production as part of this work.
Read-only production audit results remain a release prerequisite.

See [legacy reconciliation design](legacy-booking-reconciliation.md) before taking
any corrective action. New collections are additive; there is no automatic legacy
data migration and no database recreation requirement.

## Validation

```powershell
python -m pytest backend/tests -q
$env:CI='true'
npm.cmd --prefix frontend test -- --watchAll=false --runInBand
$env:DISABLE_ESLINT_PLUGIN='true'
npm.cmd --prefix frontend run build
python -m py_compile backend/server.py backend/config.py backend/services/demo.py backend/services/demo_templates.py backend/services/payments.py backend/scripts/audit_legacy_bookings.py backend/services/email/service.py backend/services/email/templates.py backend/services/email/tokens.py
git diff --check
git status --short
```

Offline regressions need pytest, FastAPI, httpx, pymongo, and the pinned Stripe SDK.
They never load the application .env or connect to Mongo/Stripe/Resend. Historical
API/database test modules are represented as skips before import; they require
`--run-local-integration`, loopback API/Mongo URLs, and a `sendjet_test_...` database.
Those suites also need their own seeded fixtures and a running disposable local
server; they have not been executed against a real database here.
