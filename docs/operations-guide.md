# Running Shree Sudhya Operations

Operations is a separate server application. Marketing stays on port 3001; operations uses port 3002. Commands below run from `E:\shreesudhyalaundryservices` in PowerShell with Node 20.19+.

## Start locally

```powershell
npm ci
npm run db:generate
npm run db:status -w @shree/operations
npm run dev:operations
```

Open http://localhost:3002/login. Use an invited and active staff account. For the current intake, piece catalogue, recount, delivery queue and billing instructions, see [Pickup to billing](pickup-to-billing.md). Stop an older process on that port before restarting; Next reads environment values on startup. The ignored `apps/operations/.env.local` already contains the owner-configured Supabase URL, public key, APP_URL and Session pooler DATABASE_URL on this workstation. Never commit or share this file. CLI migration, setup and worker commands now load it automatically. Do not replace the local file with `.env.example` once configured.

In a SECOND terminal, start the durable worker:

```powershell
npm run worker -w @shree/operations -- --watch
```

The worker prepares due scheduled drafts, renders invoice PDFs and produces private CSV exports. Closing it pauses background work; jobs stay in PostgreSQL and resume when a worker restarts. Run without `--watch` for one bounded batch of up to 100 jobs. Ctrl+C stops the watcher. No SMS, WhatsApp or payment-provider message/charge is sent.

## First administrator — required before signing into the workspace

1. In this project's Supabase dashboard, invite your own administrator email under Authentication / Users. Accept the invitation and set a password. If necessary use the application's password recovery screen after invitation.
2. Set the Auth site URL to `http://localhost:3002` and allow the exact callback `http://localhost:3002/auth/callback`. Use your deployment origin instead in staging/production. Disable public signup in Supabase; hiding signup in this application does not disable the provider's public API.
3. In your own terminal, run:

```powershell
npm run setup:admin -w @shree/operations
```

Enter the invited verified email, display name and password at its prompts. Password entry is hidden, not saved. The command signs into Supabase, verifies the real identity and creates the initial application administrator transactionally. It refuses when any administrator already exists. There is no default password or demo-login bypass. This interactive account setup has not been executed for the owner because no invited account was supplied.

4. Sign in at http://localhost:3002/login.

For additional executives/supervisors, invite verified identities first, then use `db:provision` with the documented local operator configuration in local-setup.md. A server-only Supabase service-role key is needed by that existing provisioning CLI; never put it in NEXT_PUBLIC variables or chat. Use the application's User/access screen to find application profile IDs; pickup assignment uses those profile IDs, not Supabase identity IDs.

## First working journey

Admin: create a client, branch, processing unit, garment types and services. Provision an executive. Open Settings and approve a proof-of-delivery policy independently. Open Finance when ready to save owner/accountant-approved financial settings. Financial posting is blocked until those are approved; no live currency, tax or contractual date was guessed.

Coordinator: Operations → Arrange pickup. Choose branch, unit, executive, schedule and garment/service lines.

Executive: Operations → assigned order → Start travel → Confirm arrival → Record actual collection counts.

Supervisor: receive laundry custody → count each inward line. If pickup/inward differ, an Admin reviews the discrepancy and approves observed stock with a reason; original observations remain unchanged.

Supervisor: allocate available stock with machine/operator references → complete each service-specific step → record QC passed quantities. Rejected quantities enter rework; process and QC them again. Approve outward quantities, assign delivery and dispatch.

Assigned executive: record actual acknowledged quantities, recipient/reference and return notes; attach evidence when policy requires it. A partial acknowledgement returns the unaccepted balance to released laundry stock. **Confirm physical return before using acknowledgement/failure commands that record returned stock.** Reassign remaining stock for another delivery. OTP verification is not simulated.

Admin: configure an effective branch or client rate. Generate a concrete half-open billing cycle [start,end); only fully reconciled orders completed inside it qualify. Review source lines, rate explanations and exclusions → approve → issue. Legal-format approval is required. Run worker for PDF. Record money already received, then allocate it to this client's issued invoice; record credit adjustments/reversals as needed. Expense approval and recording payment are separate.

Reports: choose work, quantities, invoices, payments, expenses or customer statement. Filter explicit UTC instants and client/branch IDs. CSV exports neutralize spreadsheet formulas. Private job exports expire 15 minutes after generation; current identity/scope is checked again on download. Worker removes expired CSV bytes while retaining job metadata.

## Build / production-style local run

```powershell
npm run build:operations
npm run start -w @shree/operations
# Separate terminal:
npm run worker -w @shree/operations -- --watch
```

Use a long-running Node host and a separately supervised worker for deployment. Operations cannot be hosted as the marketing static export. Configure environment secrets on that host, TLS, exact APP_URL, Supabase callback allowlist, database connection limits and restricted server runtime role. Do not serve `.env.local` or database backups. Use `npm run db:migrate -w @shree/operations` only after inspecting the intended target and reviewing migrations.

### Render

The repository-root `render.yaml` defines a Node web service and a background worker in Singapore. Connect the repository in the Render Dashboard and use the Blueprint with four environment values supplied privately for the web service.

- `DATABASE_URL` uses the existing PostgreSQL runtime connection. The worker inherits the same value.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` identify the Supabase Auth project.
- `SUPABASE_SECRET_KEY` allows the server to provision staff accounts for admin approval.

The web service uses its Render HTTPS origin for `APP_URL` by default. Set `APP_URL` to the exact HTTPS origin if you use a custom domain, then add that origin's `/auth/callback` URL to Supabase Auth. Check `npm run db:status -w @shree/operations` against the intended database before launch. The Blueprint builds the application and generates its Prisma client. Apply any approved database migrations separately.

After deploying, verify staff sign-in and confirm the worker can process an invoice PDF and a queued export. Check both services' logs before switching staff to the hosted CRM.

## Verification commands

```powershell
npm run check
npm run test:integration
npm run db:status -w @shree/operations
```

`TEST_DATABASE_URL` must name an isolated database ending `_test`; the test runner applies migrations there, never to the application database. This workstation has a separate `laundry_operations_test` database. Tests retain explicitly fictional fixtures and immutable history there. Never copy these identities/data into production. Browser journeys require separately invited test identities and an authorized browser environment.

See phase-2-4-status.md for the exact feature inventory, tested behavior, implementation choices and remaining production blockers. Read release-checklist.md before a pilot.
