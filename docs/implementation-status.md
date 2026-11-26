# Current implementation — 2026-11-17

## Admin billing and incident workflows

Branch detail links preselect the branch in pricing and monthly billing. Month presets use Tirupati time. The invoice pickup register groups saved billed lines by original collection date, combines quantities for repeated same-day pickups, counts distinct pickup orders, separates units and sums saved minor-unit amounts. Invoice eligibility still uses the existing completion period. Historical drafts and invoices use source order dates where available.

Admin receipt verification records an immutable audit event. The internal payment-confirmed sales KPI includes fully settled issued invoices net of credit adjustments and including tax, backed by verified unreversed allocations. Historical receipts are not automatically verified. Existing recorded-receipt balances remain on the legacy allocation basis. This is a current settlement KPI without a dated recognition ledger. Loss and damage incidents are auditable work-order records and do not automatically change garment balances or post an expense or credit.


## Operations interaction repairs

The [interaction audit](interaction-audit.md) records 26 interaction families and their evidence boundaries. The [workflow verification report](workflow-verification.md) records the role walkthroughs and actual check outcomes.

New failed and partial deliveries retain undelivered stock in transit until an authorized coordinator confirms physical receipt. Historical closed attempts use their existing state. Report export and evidence uploads now use input-specific retry keys. No schema migration is required. The new CRM collection bridge, payment verification and recognition, expense corrections and authenticated browser acceptance remain open.


## Operations dashboard drilldowns

Executive pickup and delivery stage cards share their server filters with the assigned work lists. The Admin unbilled card opens completed orders without billing allocations. Finance overview labels distinguish invoiced amounts and recorded receipts. Payment verification and sales recognition remain separate implementation work.

Operations lint, type checks, 25 unit/API/source tests and the production build passed. The earlier integration run lost database connectivity. The retry passed all 24 tests on isolated PostgreSQL with no pending migrations, including the new scoped pickup count/drilldown regression. Authenticated visual verification remains open.


## Operations shell refinement

The first redesign pass preserves the existing approved logo and role navigation. The header displays the business date in Tirupati time, menu search announces empty results, and collapsing the sidebar clears the filter. The mobile drawer uses native modal focus behavior, including its search input. Operations lint, typecheck and 25 unit/API/source tests passed. Authenticated browser verification and a refreshed local production build remain pending.


## Finance and operations Phase 0 audit — 2026-11-21

See the [finance and operations implementation plan](finance-operations-implementation-plan.md) for the current audit and Phase 0–8 acceptance gates. The owner's Business Overview sketch and verified-payment rule govern the planned finance changes. Earlier implementation reports remain dated evidence.

- **Implemented and verified at source level.** The current branch, staging status and relocation pairs were inspected. Both targeted migration baseline source tests passed, covering all five migration files, normalized hashes, table/model coverage and named guards. The current source includes CRM assignment and alerts, legacy order custody and quantity controls, invoice issue and PDF retry, receipt allocation/reversal, credits, and basic expense approval/payment.
- **Implemented but unverified in this audit.** Current hosted catalog and migration status, real WhatsApp delivery, invited staff journeys, runtime grants, worker/evidence retention, browser accessibility and backup/restore. Prior test and migration results are preserved in their dated reports.
- **Not implemented against the finance master.** Explicit Admin payment verification, verified collections and a reversible sales-recognition ledger. Current non-reversed receipts can affect balances before verification, and issued invoice totals are styled as sales. Missing work also includes atomic order creation at CRM collection, fuller expense proof/review/attribution and reversal, and protected correction controls. The sketch's example counts must never populate real queues.
- **Blockers.** Approve recognition/tax/cutoff and correction policies, confirm access roles and test identities, reconcile the marketing relocation and unrelated artifacts, and authorize an isolated staging catalog and historical reconciliation review.
- **Next recommended task.** Agree the finance state/permission matrix and reconcile the release baseline, then verify the existing CRM milestone in staging. Use the phased plan for the collection bridge and subsequent finance work.

This pass changed only planning documentation. It made no database connection, migration, feature change or deployment.


### Owner-confirmed finance acceptance

Admin verification of received funds is required before payment can trigger sales recognition. Unpaid invoices remain receivables, pending receipts stay outside verified collections and recognized sales, and expenses remain separate. Incorrect financial entries require an authorized, auditable correction or reversal that retains the original record. Release requires real persistence, authorization, reconciliation, reversal, mobile and accessibility tests. See the [release gates](finance-operations-implementation-plan.md#owner-confirmed-financial-release-gates) for the test cases. No tests were rerun for this documentation update.


## Phase 1 CRM implementation

See [Phase 1 CRM acceptance](phase-1-crm.md) for the walkthrough, role and replay boundaries, provider configuration and release limits. Phase 1 adds separate lead and pickup records, supervisor queues and audited conversion, executive assignment and notifications, and signed WhatsApp intake with raw-payload expiry. The sample experience now lives at /demo. Existing work-order rows remain accessible. New CRM pickups end at branch arrival until Phase 2 adds order creation at collection.

The latest attached master specification extends later finance and release phases, including payment-verified sales recognition. These changes are deferred. The migration was applied only to the configured isolated _test database. The external Meta integration and authenticated visual staff journey remain staging acceptance items.


## Phase 0 audit — 2026-11-21

See [workflow implementation plan](workflow-implementation-plan.md) for the audited working tree, schema-to-SQL comparison, workflow gaps and acceptance gates. This audit uses the phase numbering from the latest master specification. The older phase numbers and results below are retained as historical records.

### Implemented and verified in this audit

- Operations unit/API/source suite passed 24 tests across 8 files, including migration baseline source checks. Domain suite passed 18 tests across 2 files.
- Source inspection confirmed the four migration directories, SQL-only WorkOrder foreign keys and history constraints. Git inspection confirmed a wholly unstaged relocation with paired marketing paths.
- Source inspection confirmed the former public demo redirects to login. Sample dashboards and optional test autofill are development-only. Role preview navigation is entered from login.

### Implemented but unverified here

- Current hosted migration history, RLS/grants, row counts and Prisma-to-database drift. Earlier dated records describe four applied migrations. No live connection was opened in Phase 0.
- Authenticated pickup-to-payment lifecycle, real provider invitations, scoped runtime credentials, browser/mobile/accessibility, worker operation, storage and backup recovery. Existing workflow, finance, reporting and worker services were inspected. Their operational acceptance requires staging.
- No build, browser, isolated database integration or deployment check was run in this audit.

### Not implemented against the latest specification

- Separate CRM lead, reviewed pickup and order-on-collection records, inbound WhatsApp intake, client/site catalogue rules, and executive laundry-arrival handoff.
- Full discrepancy/quality workflow for damage, unknown items and wrong service, managed machine/operator capacity, persisted same-route delivery grouping, and user-facing notifications.
- Recurring contractual cycle calendar, approved consolidated billing if required, complete as-of statements, provider object storage/scan lifecycle, and release monitoring/rehearsal. Existing branch billing, private PostgreSQL evidence and outbox are available as foundations.

### Blockers

- Agree on the release baseline and disposition of unrelated campaign output. Reconcile current relocation against the marketing remote-tracking commit before staging.
- Provide an authorized isolated staging target and invited role identities to verify migrations, live grants, authorization, browser journeys and recovery. Production remains outside this audit.
- Resolve catalogue, discrepancy/POD, route grouping, invoice/tax/pricing, notification and evidence-retention decisions in the plan.

### Next recommended task

Review the Phase 0 findings, then begin the Phase 1 CRM and pickup design on an agreed baseline. Start with transactional lead conversion and scoped assignment tests in an isolated environment. Preserve the existing order/quantity and billing invariants.


## Phase 0–1 stabilization update (2026-11-21)

The operations app now rechecks persisted authorization before returning saved command responses, limits executive order and evidence access to assigned work, and exposes staff administration to active Admins. The role menus, finance views and shared operations components use the existing CSS and logo assets. Invitation intent is durable and email delivery requires separate provider configuration and staging acceptance. The demo uses fixture data and its own presentation context.

The repository and migrations take precedence where the older Phase 1 documents describe private files, assignments, finance, quantity movements or the worker as future work. Those features already exist. The original rules for exact money, immutable history, quantity conservation, scoped access and invited identities still apply. See [the release baseline](release-baseline.md) for the drift inventory, safe commands and remaining release checks. Verification farther down this file records the earlier November 17 baseline.

The core of phases 1–4 is implemented: authenticated masters/access; scoped pickup-to-delivery workflows and immutable quantity movements; configurable source-based billing, receipts, credit adjustments and expenses; reconciled reports, scheduled draft/PDF/export workers; and a public, isolated demo UI. This is not a claim that every feature from the original brief or every production release gate is complete. See [detailed inventory and limitations](phase-2-4-status.md) and [how to run operations](operations-guide.md).

## Available locally

- Operations login: http://localhost:3002/login — **View demo UI** button.
- Interactive sample workspace: http://localhost:3002/demo — Admin/Supervisor/Executive role previews, searchable queues, order and invoice detail dialogs, local stage simulation/reset; no login session or real-data API access.
- Marketing preview: http://localhost:3001 — preserved branding/content, restarted on the patched framework.
- Real workspace needs an invited verified administrator and `npm run setup:admin -w @shree/operations`; zero application profiles currently exist. No default password, fake auth bypass or production sample seed was created.

## Final verification

| Check                                                                          | Result                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Marketing production build, Next.js 16.4.5                                     | Passed                                                                  |
| Final operations production build, Next.js 16.4.5                              | Passed                                                                  |
| Workspace lint and typechecks; final operations/domain checks                  | Passed                                                                  |
| Domain tests                                                                   | 18 passed                                                               |
| HTTP/API unit tests                                                            | 9 passed                                                                |
| Real PostgreSQL integration tests in isolated laundry_operations_test          | 12 passed                                                               |
| Marketing cycle, bubble/garment, 144 numerical viewport, export/contact checks | Passed                                                                  |
| Production dependency audit                                                    | Zero reported vulnerabilities                                           |
| HTTP /login and /demo                                                          | 200; demo button/sample labels verified                                 |
| Anonymous /api/v1/work and /api/v1/finance                                     | 401, no real data returned                                              |
| Marketing HTTP home                                                            | 200, brand content verified                                             |
| Application database migrations                                                | Four applied; schema up to date                                         |
| Application table RLS/browser grants                                           | 24/24 protected; zero anon/authenticated table grants                   |
| Application data                                                               | 0 profiles, 0 orders, 0 invoices, 0 receipts; no test fixtures inserted |
| Worker single-batch startup on application DB                                  | Passed, 0 jobs processed, exited cleanly                                |
| Authenticated owner identity/browser/visual acceptance                         | Not run; invited identity still required                                |
| Backup/restore and production load rehearsal                                   | Documented, not run                                                     |

The aggregate `npm run check` initially caught a Node-only import in a domain test; replaced it with the standard crypto API. All corresponding final lint/type/unit/build checks passed afterward. One PostgreSQL retry failed during connection setup before any cases ran; explicit TLS, bounded pool size and connection allowance are configured locally. Subsequent tests caught immediate-due worker fixture sensitivity to clock alignment; due jobs now have explicitly past fixture availability, and a separate future-job test proves no early claim. Final full PostgreSQL run passed all twelve, including source-history DB guards. No failed/skipped attempt is counted as a pass.

A newly reported Next.js advisory GHSA-mfr8-8qww-v76h affected 16.4.2. Applied the documented 16.4.5 patch to both workspace packages, rebuilt both and restarted local previews. Production audit is clean; the earlier seven moderate development-tool advisories were not resolved by unrelated forced major upgrades.

## Hosted changes applied through CLI

Existing Prisma history was retained rather than duplicated in Supabase CLI history. The two additional reviewed/tested migrations were deployed using Prisma CLI against the supplied Supabase Session pooler:

- 202611170002_operations_finance: order aggregate, immutable movements, private evidence, policy, effective rates, source reservations, invoices, receipts/allocations, credit adjustments, expenses, numbering and worker leases/retries; server-only RLS/grants and integrity protections.
- 202611170003_history_guards: issued billing-source immutability, movement unit/bucket checks, invoice state/number requirements, receipt reversal consistency and expense states.

`db:status` confirms all four migrations applied. No destructive reset, web deployment or Git push was performed. Test fixtures remain exclusively in the separate test database. The CLI Management API account still lacks access to this project's administration; working PostgreSQL access does not change that separate permission boundary.

## Required before a real pilot

Invite/verify and bootstrap Admin; provision scoped supervisors/executives; disable provider public signup and review identity settings; review independently configured POD and financial/legal policies; provision a restricted runtime DB role; supervise the worker; complete authorized browser/phone/tablet acceptance and backup/restore. Statutory multi-tax/numbered credit-note documents, recurring contractual calendar generation, provider Storage/virus scanning and a notification center remain feature gaps detailed in phase-2-4-status.md. No external notification delivery or real banking/payment transaction is simulated.

---

## Historical phase notes (superseded where the current record above differs)

# Phase 1 completion report

## Scope and repository decisions

The supplied master brief explicitly says to begin and stop with Phase 1. The later prompts are reference requirements, not completed modules. No separate detailed analysis report was supplied beyond existing repository documentation. No production deployment, hosted migration, invite, cloud provisioning or project-setting change was performed.

The existing marketing site was moved intact to apps/marketing, with all prior uncommitted contact changes preserved. A byte comparison checked 41 previously tracked source/assets; only the pre-existing contact edits differ from HEAD. The unrelated output/ folder is untouched. Static export, logo, original About artwork, gallery and washer tests are retained.

Npm workspaces separate apps/marketing (static, port 3001), apps/operations (server-enabled, port 3002), packages/domain (framework-independent rules). Existing marketing runtime dependencies were not upgraded. CSS/native accessible controls and Lucide are used instead of introducing Tailwind/shadcn, avoiding a competing styling framework. Root TypeScript, ESLint and Prettier configs are shared where practical.

Prisma 6.19.3 is compatible with installed Node 20.19; Zod 4.6.7, Vitest 4.1.12 and patched compatible tooling were selected after audit. A narrow @prisma/config deepmerge-ts 8.0.2 override fixes the config utility advisory; generation, schema validation and builds validate its import/API compatibility. No node_modules patch or console suppression is used.

## Implemented and verified locally

- Branded sign-in, password recovery/reset pages, native responsive drawer, collapsible desktop sidebar, profile/sign-out menu and role-aware navigation.
- Server-only Supabase identity verification, active-account checks, persisted roles/scopes, no fake login or localStorage database.
- Typed /api/v1 master-data routes with exact Origin/JSON size checks, stable error codes and server-generated correlation IDs.
- Real Prisma/PostgreSQL implementations for clients, branches, units, garment types and service catalog. Lists enforce scope, literal substring search, sorting, archive filters and pagination. Create/edit/detail/archive/restore UI calls server commands, not local-only state.
- Atomic serializable master commands with active-parent validation, optimistic versions, per-actor request idempotency, append-only audit and transactional outbox records. No outbox dispatch claimed.
- One-off initial Admin bootstrap and controlled additional verified-identity provisioning CLIs, with no public bootstrap/user-registration endpoint.
- Independent marketing and operations builds passed. Workspace TypeScript/lint passed. Marketing timeline, garment, bubble, 144 layout-budget and export checks passed. Domain/API unit tests passed (17 tests after adding partial-update regression coverage).
- Production HTTP: login/recovery/reset return 200; anonymous workspace requests redirect; five master API GET requests return 401; cross-origin writes return 403; anonymous same-origin writes return 401. These checks do not prove authenticated persistence.
- Prisma schema validation and client generation passed. One reproducible migration is committed in the source tree, not applied to a hosted database.
- Production dependency audit: zero reported vulnerabilities. Full audit still reports seven moderate advisories in existing TypeScript-ESLint/minimatch development tooling; no forced unrelated dependency upgrade was made.
- Supabase settings endpoint reachable using the owner-supplied public URL/key. Email provider is enabled. No identity or project data was created by this check.

## Implemented but unverified

- Managed sign-in, recovery email delivery, session refresh, bootstrap, provisioning and sign-out with an actual invited user.
- Master persistence, real PostgreSQL serializable conflicts, idempotent concurrent retry, parent constraints, immutable audit trigger and restricted browser-role grants.
- PostgreSQL integration suite is delivered and requires TEST_DATABASE_URL with an isolated database name ending in \_test. Running it without that setting failed at its safety guard: zero DB tests executed. Docker CLI exists but its daemon is stopped. No SQLite/mock result is represented as proof of database concurrency.
- Playwright desktop/phone and gated invited-Admin acceptance tests are delivered, not run: the prior browser automation URL-policy denial has not been bypassed by launching an alternate browser. No screenshot certification is claimed.
- CI now includes isolated PostgreSQL migrations/integration tests, but this phase was not pushed or executed remotely without further approval.

## Not implemented in Phase 1

Pickup/order/verification/quantity-ledger execution, batching, QC/rework, custody, delivery/POD, file evidence/storage access, finance/pricing/billing/invoices/payments/expenses, operational KPIs, background dispatch/workers and exports. No fake operational charts or activity are displayed. The overview only counts authorized active master records and links to matching lists.

Users/access is an authorized paginated visibility screen; invitation/permission editing is a controlled CLI procedure, not an unfinished button advertised as a working UI. Branch users and operator logins are not enabled. Business policies for later phases are documented, not guessed.

## Blockers / owner actions

1. Provide DATABASE_URL locally in apps/operations/.env.local for a development database. The supplied Supabase URL and publishable key are stored only in ignored local configuration; they are not sufficient for PostgreSQL access.
2. Explicit approval is required before any migration against the owner's hosted project. Prefer local/staging first.
3. The Supabase project currently allows public signup (disable_signup=false at read-only inspection). Invite-only application UI is not equivalent to disabling provider signup; the owner must approve or perform that configuration change.
4. An invited, verified test Admin identity and local bootstrap are required to complete the sign-in/client/two-branch/catalog/refresh/sign-out acceptance journey.
5. The host C: drive filled during tooling; npm/temp caches were redirected to E:. No unrelated user files were deleted. This is an environment constraint, not an application error.
6. Owner/accountant currency, timezone, tax, numbering, pricing-date, POD, compensation and retention/backup decisions remain required before the relevant later phase.

## Migration and manual walkthrough

Initial migration: apps/operations/prisma/migrations/202611160001_phase1/migration.sql. It creates access/master/audit/outbox/idempotency tables, foreign keys/indexes, scope/version constraints, audit immutability and conditional privilege revocation for Supabase browser roles. Generated and schema-validated only; not claimed executed.

Follow docs/local-setup.md for environment, local migration, invited Admin bootstrap, client/two-branch/catalog creation, refresh, concurrent-edit retry, scoped Supervisor denial, disabled account and sign-out. Follow docs/security-model.md and docs/release-checklist.md before staging. Backup/restore is documented but not rehearsed.

## Exact checks performed

- npm install (workspaces; targeted security updates, no existing runtime upgrade).
- npm run db:generate (Prisma 6.19.3) - passed.
- prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script - generated initial SQL; no database mutation.
- prisma validate with a dummy local connection string - schema valid, no connection used.
- npm run check - both builds, lint, typechecks, applicable unit/export checks passed before final pagination refinements; the final operations rebuild, workspace typechecks and tests also passed after the refinements.
- npm run test -w @shree/domain - 11 passed.
- npm run test -w @shree/operations - 6 passed.
- npm run test:integration - blocked by absent TEST_DATABASE_URL; not passed.
- npm audit --omit=dev - zero reported vulnerabilities; full audit seven moderate dev-tool advisories.
- Production Node HTTP assertions - auth pages, redirect, anonymous/same-origin/cross-origin denial passed.

## Next recommended task

Configure an isolated development PostgreSQL database, apply the reviewed local migration, bootstrap the verified invited Admin and run the real persistence/concurrency acceptance suite. Resolve public-signup settings and run authorized browser QA. Fix any Phase 1 integration issues before beginning Phase 2. Do not proceed into finance yet.

## Phase handoff inventory

- Current local preview: operations login at http://localhost:3002 (server started after final build); marketing remains at its existing public port when preview/dev is running.
- 41 tracked marketing source/assets were compared after relocation; previously uncommitted contact changes are preserved.
- New framework-independent rules: packages/domain/src/index.ts and its 11 tests.
- New operations modules: managed auth/proxy, server authorization, master repository/transactions, typed HTTP routes, responsive shell, auth forms, master forms/lists/details, archive control, access/audit/settings views, errors/loading, Prisma schema/migration, bootstrap/provision scripts, six API/HTTP unit tests, PostgreSQL integration suite and Playwright journeys.
- Configuration: root workspaces/lockfile, shared tsconfig/ESLint/Prettier, independent builds and CI PostgreSQL test service. No workflow was pushed/executed remotely during this phase.
- Production audit has zero findings; full development audit has seven moderate pre-existing lint-tool advisories.

No production migration, deployment, Supabase setting change, real invitation, message or payment was sent. This is an implemented Phase 1 foundation with database/auth acceptance still blocked, not a certified live operations rollout.

Final repeat: operations build, all workspace typechecks/tests, lint and new-code Prettier checks passed. The responding login preview shows Local setup required because DATABASE_URL is absent; anonymous master API access returns 401. No authenticated DB acceptance is claimed.

## Hosted CLI attempt — 2026-11-16

The owner authorized pushing Supabase changes through the CLI and continuing all phases. This supersedes the earlier pending hosted-migration approval; no repeat approval is required for that scope.

Supabase CLI 3.2.0 is available through npx. `supabase projects list` succeeded for the currently authenticated account but did not include the supplied project `tknqtsvyojeniijwdhft`. `supabase link --project-ref tknqtsvyojeniijwdhft --yes` failed with `LinkProjectStatusError`: the account lacks the necessary privileges to access the project endpoint. No database migration or project configuration change was applied. No other project was targeted.

Required next input is local CLI authentication with access to this exact project and a PostgreSQL DATABASE_URL in the ignored operations environment file. The publishable key cannot authorize database migrations. Before applying anything, inspect remote schema and migration history: the existing migration is Prisma-managed, so do not independently apply identical SQL under a second migration history without reconciling tracking.

Phases 2–4 are not complete. The specification requires blocking Phase 1 database/auth acceptance issues to be fixed before extending operations. Hosted schema verification, isolated PostgreSQL integration tests, and invited-admin acceptance remain outstanding. Financial policy approvals remain required before issuing real financial documents.

## Hosted migrations applied — 2026-11-17

The locally configured Session pooler connection successfully authenticated to the supplied Supabase project. Read-only inspection found no public application tables or Supabase migration tables before deployment. Prisma CLI `migrate deploy` applied `202611160001_phase1` successfully. No reset or destructive schema synchronization was used.

Post-deployment inspection found Supabase default browser grants on `_prisma_migrations`, although the eleven application tables correctly denied those grants. Added and applied `202611170001_server_table_security`: revokes browser/PUBLIC privileges on migration metadata and application tables and enables RLS without browser policies for all twelve server-owned tables. The privileged server connection remains responsible for explicit application authorization.

Final hosted verification: both migrations completed; twelve public tables exist; all twelve have RLS enabled; zero table grants remain for anon/authenticated; audit immutability trigger exists. Auth identity count is zero. No user accounts, master fixtures, orders or financial data were created. Full authenticated application acceptance and PostgreSQL concurrency tests are not yet claimed. Docker daemon remains unavailable and TEST_DATABASE_URL is not configured.

The CLI account's Management API access remains separate from the now-working PostgreSQL connection. Hosted migrations were applied with the existing Prisma CLI migration history, not duplicated in a separate Supabase CLI history. Invite-only Auth settings still require authorized project administration. Phases 2–4 remain incomplete pending foundation acceptance and their implementation.
