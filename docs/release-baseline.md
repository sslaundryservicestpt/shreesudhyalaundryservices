# Phase 0–1 stabilization baseline (2026-11-21)

## Resumable plan

- [x] Phase 0: preserve relocation/unrelated files, enumerate migrations and SQL-only invariants, add chain/coverage checks, verify isolated PostgreSQL migration application.
- [x] Phase 1a: mandatory current authorization before command replay; executive detail projections; denial/revocation tests.
- [x] Phase 1b: audited Admin staff management; durable invite intent (no external message during implementation), access changes, self/last-Admin protection.
- [x] Phase 1c: server-role-aware navigation, real finance sections, shared operations UI/token foundation, preserved login/demo isolation.
- [x] Local verification passed for both builds, workspace checks and isolated PostgreSQL.
- [ ] Release verification requires the browser and staging checks listed below.

## Starting repository

Branch main; HEAD 08c6fb6. Relocated tracked source groups: src → apps/marketing/src; public → apps/marketing/public; scripts → apps/marketing/scripts; design → apps/marketing/design. Root application next/tsconfig files have workspace equivalents. Git currently shows deletions at original paths and untracked apps/packages/docs, not a committed move. Preserve output/ and all local environment/history/check folders. No commit, clean/reset, production migration or deployment is authorized by this phase.

The final workspace inventory showed no staged entries, 43 tracked deletions and 9 tracked modifications. The deletions are from the prior root layout. The untracked inventory included 168 files in apps, 7 in packages, 12 in docs and 7 in output. The root also had untracked Prettier config, shared TypeScript config and contact implementation notes. Review the relocation as a single change before staging it. Leave output and generated `.next/`, `out/`, `node_modules/`, test results and local check caches outside source review. Inspect ignored environment files only in the environment where they are used.

Installed core versions used for the workspace verification were Next.js 16.4.5, Prisma 6.19.3, React 19.3.1, TypeScript 6.0.3, Vitest 4.1.12 and Playwright 1.58.2. The migration scripts resolve the Prisma CLI from the installed operations workspace.

Migrations in order: 202611160001_phase1, 202611170001_server_table_security, 202611170002_operations_finance, 202611170003_history_guards. SQL contains RLS/grants, immutable triggers, CHECKs and WorkOrder master FKs not fully represented by Prisma. Do not use db push/reset or rewrite applied migrations. Missing financial FKs/indexes and JSON aggregate schema versioning require reviewed additive changes later; schema constraints are not inferred as absent merely because Prisma cannot represent them.

## Acceptance and safe commands

Run npm run check for source checks/builds. npm run test:integration explicitly migrates and writes only TEST_DATABASE_URL ending \_test. Never point it at the application database. Inspect db:status separately; do not run db:migrate against production in this phase. Run test:browser only in an authorized test/browser environment and with invited test users, never a fake login.

Staging: independently provision secrets and exact APP_URL/redirect allowlist; disable public signup; establish restricted DB runtime role with reviewed RLS policies; apply reviewed migration chain with operator credentials; run auth/scope/replay and quantity/finance smoke tests; supervise worker; monitor failures.

Backup: authorized operator takes encrypted pg_dump backup including evidence/PDF bytes and immutable history; restore into a separate environment; verify counts, constraints, identities/scopes and job state. Define RPO/RTO and owner-approved retention. No restore rehearsal or production inspection is claimed by this document.

## Source conflicts

business-rules.md, security-model.md and quantity-ledger.md still describe Phase 1-only functionality, while actual domain/services and four migrations implement later workflows. Preserve approved rules (scope union, exact money, conservation, invite-only policy); obsolete statements that finance/ledger/assignment do not exist are historical, not an instruction to delete working functionality. See the stabilization update in implementation-status.md.

## Drift inventory

| Area                 | Repository finding                                                                                                                                                                                                                             | Staging follow-up                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Work order relations | SQL protects branch, client, unit and executive references. Prisma exposes scalar IDs only.                                                                                                                                                    | Preserve the named foreign keys. Validate existing data before modeling relations or adding cross-field constraints. |
| Finance references   | Billing allocations and payment allocations reference their source documents. Rate contracts, invoice branch/client IDs and payment client IDs lack corresponding database foreign keys.                                                       | Reconcile historical IDs before additive constraints. Preserve issued invoice snapshots and document numbering.      |
| Index coverage       | Branch/queue and executive/scheduled indexes support common work reads. Client and unit queue predicates and JSON delivery assignments have no dedicated indexes. Allocation lookup by payment and credit lookup by invoice also merit review. | Use representative staging data and query plans before adding indexes.                                               |
| SQL-only invariants  | Scope checks, positive quantities and amounts, reversal pairing, immutable audit/history triggers, RLS and grants are outside parts of the Prisma model.                                                                                       | Review generated SQL and compare catalogs after any schema change.                                                   |
| JSON aggregates      | Work state, policy and issued snapshots contain typed application data stored as JSON. Several readers assume the existing shape.                                                                                                              | Plan runtime schema validation and versioned compatibility for historic rows before changing the data format.        |

The committed-source checks compare normalized schema and migration hashes, match the SQL table list to the Prisma model list and assert selected SQL invariants. The isolated PostgreSQL checks inspect migration records, columns, RLS, named constraints, indexes and active triggers. These are targeted checks. They do not compare every column type, default, policy or database privilege.

## Local operation and staging acceptance

1. From the repository root run `npm ci`, then `npm run db:generate` if the Prisma client has not been generated locally.
2. Run `npm run dev:operations` and open `http://localhost:3002/login`. Choose **Explore Demo Dashboard** to preview the UI with local sample data. Real sign-in requires an invited, active app profile. Marketing runs separately with `npm run dev:marketing`.
3. Run `npm run check` for lint, both production builds, type checks and unit tests. Run `npm run test:integration` with a disposable PostgreSQL database named with the `_test` suffix. Run `npm run test:browser -w @shree/operations` in the permitted browser environment. Set invited test-only credentials and use the isolated database for the authenticated cases.
4. In staging, sign in separately as Admin, Supervisor and Executive. Verify the sidebar and drawer, deep links, keyboard focus, narrow screen table scrolling, long customer names and amounts, loading and error states, invitation acceptance and password recovery. Confirm a disabled or unassigned account cannot re-open a saved command or a private attachment.
5. Use separately configured, verified staging operator credentials to run `npm run db:status -w @shree/operations`. Back up and rehearse the restore first, review target and migration SQL, then run `npm run db:migrate -w @shree/operations` only in the approved target. Verify the catalog and smoke tests afterward. Roll back the application version if needed and use a reviewed forward fix or rehearsed restore for database changes.

Invites are queued as `staff.invite` jobs. Delivery requires the owner-approved worker setting `STAFF_INVITES_ENABLED=true` and the server-only Supabase service key. Configure the provider invite template to pass `token_hash` and `type=invite` to the allowed `/auth/callback` route, then verify the reset-password flow in staging. A provider can accept an email before the application profile transaction succeeds. Reconcile the verified identity and job before retrying. The workflow does not guarantee exactly-once email delivery.

## Authorization evidence and open gates

| Boundary                      | Local evidence                                                                                                                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous and disabled access | Route tests verify services are not dispatched. PostgreSQL replay tests verify profile disablement takes effect with a previously authorized request.                                                                                  |
| Roles and staff changes       | Route tests deny both non-Admin staff roles. PostgreSQL tests exercise versioned role and scope changes, self-change denial, and immutable audit registration. Branch-only identities are rejected before workspace access.            |
| Scope and assignment          | PostgreSQL tests deny cross-client, cross-branch and cross-unit reads, reject an unassigned executive and recheck revoked scopes and reassigned pickup commands on replay.                                                             |
| Private evidence              | Route tests check that unauthorized requests cannot read file bytes. PostgreSQL tests verify the executive order projection excludes other staff attachments and processing state.                                                     |
| Role navigation and demo      | Unit tests exercise the allowed role destinations and shared UI states. Playwright discovers eight cases. Browser execution remains outstanding, including the isolated demo's network assertions and authenticated mobile acceptance. |

Release gates still open are authenticated browser acceptance with invited test accounts, actual invitation delivery and acceptance, staging database runtime grants, backup/restore rehearsal and representative load. Today uses UTC for pickup schedules and also includes open assigned deliveries because the current delivery model has no separate scheduled date. Finance search and sorting are URL-backed. The app does not persist personal saved filters.

| Command run                                           | Result on November 21                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                                       | Passed lint, both production builds and all workspace type checks. Operations passed 21 unit tests and domain passed 18. Marketing passed its cycle, layout and export checks. |
| `npm run test:integration`                            | Passed 20 tests on isolated PostgreSQL. Four migrations present with none pending.                                                                                             |
| `npm run test:browser -w @shree/operations -- --list` | Discovered eight cases. The browser session policy blocked local URL navigation, so this was test discovery only.                                                              |
