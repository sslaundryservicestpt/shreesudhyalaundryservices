# Operations phases 2–4: implemented core and release limits

This is an implementation inventory, not a certification that every feature in the original master brief or every production acceptance step is complete. The public marketing source and branding are preserved. A narrowly scoped Next.js 16.4.5 security patch addresses GHSA-mfr8-8qww-v76h in the shared framework; both applications require rebuild/restart after dependency changes.

## Implemented modules

### Phase 2 — pickup through acknowledged delivery

- Scoped, paginated order/work queues with searchable branch/order references; executive access is limited to pickup or delivery assignments. Current assignment and fresh persisted active roles/scopes are checked again inside commands.
- Pickup creation/assignment, reassignment and pre-collection cancellation; travel/arrival/collection; version and idempotency protection. One work aggregate is created at pickup arrangement and becomes the collected order atomically; a retry returns the same identifier instead of creating a second order.
- Immutable pickup and inward observations. Differences create explicit extra/short discrepancies. Only an administrator's reasoned resolution accepts the inward stock. Original observations are never replaced.
- Explicit quantity buckets: AVAILABLE, PROCESSING, QC, REWORK, PASSED, RELEASED, TRANSIT, DELIVERED. Initial approved acceptance moves EXTERNAL → AVAILABLE. Every later movement conserves accepted stock. Integer thousandths represent kg; whole pieces must be multiples of 1000. Display converts explicitly by unit.
- Per-order locked/versioned serializable commands, bounded serialization retries and immutable QuantityMovement rows. Concurrent batch allocation cannot over-consume stock.
- Wash/dry/fold, wash/dry/iron and iron-only routes; batch machine/operator references; QC rejects → rework; rework repeats the route without creating stock; approved QC stock → outward release.
- Delivery allocation/dispatch, recipient acknowledgement, optional required attachment, partial delivery, failed delivery and physically returned stock handling. Only one active delivery attempt per order. Partial/failed outcomes remain visible in DELIVERY_EXCEPTION queues and history. No OTP claim or fake verification.
- Private evidence upload/download: JPEG/PNG/PDF signatures, 5 MB/file, twenty files/order, active identity plus scope/assignment checks. Downloads force attachment/no-store/nosniff. Evidence is stored in PostgreSQL bytea, not a provisioned Supabase Storage bucket. Include it in backup/retention planning.
- Order detail: counts by bucket/unit, service route, custody, batches, delivery history, evidence, recent 100 audited actions, first 500 quantity movements, contextual valid commands and preserved form data after failures.

### Phase 3 — operational finance

- Independently reviewed delivery/POD policy in Settings, so operations do not require premature financial approval.
- Versioned administrator-reviewed financial policy: currency/precision, timezone, tax mode/rate, pricing date, POD, legal entity/registration, continuous prefix numbering, fallback-rate approval and legal format approval. No production defaults were approved or seeded. Currency/precision become fixed once financial records exist.
- Immutable effective rate contracts; branch > client > explicitly approved fallback; missing/overlapping matches block drafting. Unit/currency/garment/service/date dimensions are matched and rate source/date/amount are snapshotted.
- Concrete branch-wise half-open billing periods [start,end), with complete acknowledged/reconciled orders selected on completion time. Incomplete/out-of-period sources are visible in draft exclusions. Missing rates block the draft rather than silently skipping billable work.
- Serialized transactional source reservations with unique whole-order allocations; cancellation safely releases reservations; draft → approve → issue; issuance retries reuse the issued document and number. Issued snapshot/header/totals are protected by a DB trigger. PDF updates are allowed without document reissue.
- Exact BigInt minor-unit totals; thousandth-quantity multiplication; HALF_UP per line, tax on subtotal; explicit single added tax percentage or explicitly disabled tax. No float authoritative money calculations.
- PDF rendering with embedded static Lato font/OFL, durable retries of the same immutable snapshot, authorized download. The initial variable font failed rendering; replaced with a static font and real PDF generation verified.
- Idempotent receipts, same-client/currency allocations, partial payments, remaining receipt credit, guarded aggregate allocation, one irreversible receipt reversal preserving history. Issued sales and collections are separate.
- Positive credit adjustments constrained to unpaid invoice balance, separate history and explicit accountant approval gate. This is not a complete jurisdiction-specific numbered multi-tax statutory credit-note/PDF implementation. Refunds require a separate approved workflow.
- Expenses: submitted → approved → paid, or rejected; actual received/paid recording does not initiate a bank/payment-provider transaction.

### Phase 4 — reports, jobs and workspace

- Database-backed role-aware overview; linked queue counts; all-time sales/tax/credit/outstanding/overdue amounts; posted collections and approved expenses by currency; no random trends or fabricated live activity.
- Paginated/searchable work and invoices; URL-persisted filters. Supporting rate/receipt/expense lists display their latest fifty records with explicit limits. Jobs show latest twenty. Work reports filter creation time, invoices issuance time, receipts received time and expenses incurred time. Current balances include all current allocations/credits, even after a filtered issue period.
- Work aging inputs, quantities, invoice balances, receipt credit, expenses and invoice-based customer statements; client/branch/explicit UTC period filters. Reports cap at 5000 orders/documents and require a narrower period beyond the cap. Statement currently combines invoice-level current balances; open customer credit is in the payments report, not a full chronological accounting ledger.
- Scoped CSV exports with formula-injection neutralization and export audit. Asynchronous private CSV exports revalidate role/scope, expire after fifteen minutes, and have their bytes purged by the worker. Scope changes invalidate download access. No public signed-URL bearer link is used.
- Durable outbox dispatcher: SKIP LOCKED claims, five-minute leases, unique lease tokens, exponential bounded backoff, five attempts, failure visibility and audited Admin retry. Scheduled concrete billing cycles prepare drafts only; workers recheck the requesting Admin's current access. A continuously supervised worker is the reliability mechanism; no unauthenticated cron endpoint is required.
- Responsive calm navy/teal shell, mobile dialog navigation, accessible labels/focus, scoped details and real empty/error/loading states. Marketing 3D dependencies stay out of operations.
- Public `/demo` preview explicitly uses fictional data, role switching, filtering, sample order and invoice dialogs, local stage simulation and reset. Login has View demo UI. No cookies, auth session, API writes or access to real records are granted by demo.
- CLI local environment loading, hidden-password interactive first-Admin setup, migrations/status commands, isolated integration runner, and worker command.

## Deliberate implementation choices / differences from master brief

Order lines, batches and delivery attempts are a versioned JSON aggregate rather than dozens of separate child CRUD entities. Their only business mutation service locks the containing relational WorkOrder; separate immutable movement/audit records and billing foreign keys provide history and financial source linkage. This makes a complete order transaction atomic; cross-order machine-load optimization and SQL analytics across every embedded child would need a later relational projection. The original brief's exact table-per-entity list is not claimed implemented literally.

Machine/operator values are recorded references, not separate managed machine capacity/operator login modules. Evidence uses private database storage; a provider Storage adapter/virus scanning is not implemented. Scheduled billing uses concrete individually reviewed periods; recurring contractual calendar generation, grace handling and automatic next-cycle carry-forward policy need owner decisions. Late work is visible in exclusions and must be included in a reviewed later/adjusted cycle, never silently backdated.

No external notification channel has been configured or approved, so no SMS/WhatsApp/email job delivery is simulated. Work/master outbox change events are acknowledged as internal events; they are not represented as delivered notifications. Dedicated in-app notifications and a full notification-preferences center are not implemented. Branch accounts, operator login, payroll, general ledger, refunds and audited profit remain outside this implementation.

## Verification record

Use implementation-status.md for final dated command results. Final checks: both production builds, all applicable lint/typechecks, 18 domain tests, 9 API/HTTP tests and 12 real PostgreSQL integration tests passed. Worker lease/expiry-access/future-scheduling and issued-source immutability checks are included. Production dependency audit reports zero vulnerabilities. All four migrations are applied to the application database; all 24 tables have RLS and zero browser-role table grants. The worker single-batch startup passed with no jobs.

Browser automation was not bypassed after the prior URL-policy denial. Playwright journeys are supplied but not claimed executed, and no screenshot certification is claimed. The real owner invited-user sign-in/bootstrap journey remains unverified until an account is invited. Demo HTML and anonymous API boundaries are separately HTTP-checked, not substituted for authenticated browser testing.

## Production blockers / owner decisions

- Invite and verify first Admin, run setup:admin, provision executives/supervisors and test their real scope/session behavior. Disable provider public signup and review MFA/email delivery/redirects.
- Save genuinely approved financial and POD rules. Do not approve the supplied generic PDF/credit-adjustment format unless legally suitable. Multi-rate/jurisdictional tax and statutory credit-note requirements need further implementation if applicable.
- Current connection uses the owner's privileged PostgreSQL account. Provision a separate least-privileged runtime role with appropriate server-only RLS policies; example reviewed grants are in database-grants.sql and are not auto-applied.
- Configure worker supervision/monitoring, connection limits, TLS, backup/restore and evidence retention/security scanning. Backup restoration is documented, not rehearsed here. Test DB is isolated from application DB but shares this Supabase project's infrastructure/quota.
- Complete authorized desktop/tablet/phone browser QA, actual identity recovery/bootstrap/assignment walkthrough, and staging load testing. Long history and supporting list limits require further pagination/projections before large-scale rollout.
- No hosted web deployment or Git push is implied by database migration authorization. Migrations and local source must be reviewed, committed and deployed through the chosen release process.

The code spans the core of all four phases; it is not an assertion that every original feature or production release gate is complete.
