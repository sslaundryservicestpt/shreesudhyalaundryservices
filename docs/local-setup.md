# Current setup instructions

Use [operations-guide.md](operations-guide.md) for current run, migration, first-admin, worker and test commands. The historical Phase 1 notes below describe the original setup; CLI commands now load `.env.local` automatically. Hosted migrations were subsequently authorized and applied as recorded in implementation-status.md.

# Local development and Phase 1 acceptance

## Workspace commands

Node 20.19+ (CI Node 22). Run npm ci at repository root.

- npm run dev:marketing — unchanged public static-export site, port 3001.
- npm run dev:operations — server-enabled internal app, port 3002.
- npm run db:generate — generate Prisma client.
- npm run check — workspace lint, independent builds, types and unit/export tests.
- npm run test:integration — real PostgreSQL test suite; never uses SQLite as a substitute.
- npm run test:browser -w @shree/operations — configured Playwright browser journeys.

## Configuration

Copy apps/operations/.env.example to .env.local, then add the Supabase URL, publishable key, APP_URL and PostgreSQL DATABASE_URL. All env files except examples are ignored. Never paste a database password, service-role key or access token in chat or commit it. Public Supabase keys are not database credentials. Prisma CLI does not read .env.local automatically; export the same DATABASE_URL in the shell before CLI commands.

Create a LOCAL PostgreSQL database, using PostgreSQL 16 or later. A suggested development connection is in .env.example; its password is illustrative local configuration only, not a credential for a provisioned service. Docker CLI is present in the current environment but its daemon was stopped during implementation.

Apply committed migrations only to the local development database: npm run db:migrate -w @shree/operations. This command is documented, not run against the owner's hosted project. Inspect the target before every migration. Production migration approval is required separately.

In the managed Supabase project, invite the initial Admin using provider administration, disable public signups, and allowlist the exact APP_URL/auth/callback redirect. Email delivery, password policy, anti-abuse and MFA must be reviewed before production. The owner-supplied project's settings endpoint was reachable, email enabled, but public signup was enabled at read-only inspection; it was not changed.

## Initial administrator bootstrap

Authenticate the invited and verified Supabase identity to obtain its access token through a trusted local operator session. Export BOOTSTRAP_AUTH_USER_ID, BOOTSTRAP_EMAIL, BOOTSTRAP_DISPLAY_NAME, BOOTSTRAP_ACCESS_TOKEN and the local DATABASE_URL/Supabase configuration. Run npm run db:bootstrap -w @shree/operations. The script verifies that token remotely, enforces the supplied identity/email, acquires a PostgreSQL advisory lock, and refuses if any Admin already exists. It does not create a password or public bootstrap route. Remove the token from your shell afterward.

For additional users, invite/verify in Supabase first; an authorised operator runs npm run db:provision -w @shree/operations with a server-only SUPABASE_SERVICE_ROLE_KEY and PROVISION_USER_JSON containing actorId (existing active Admin profile UUID), authUserId, displayName, role and scopes. Each scope has exactly one of clientId/branchId/unitId. No production account is seeded. Branch users are blocked for now. Treat access to this CLI/database credentials as trusted operator access, not an untrusted end-user action.

## Acceptance walkthrough (requires configuration)

1. Sign in as the invited Admin at port 3002.
2. Add a fictional client, then add two branches using that client.
3. Add a laundry unit, a garment type with explicit unit and a service route.
4. Refresh detail/list pages to verify database persistence. Search and filter via URL query parameters.
5. Edit one record in two windows; the second stale version must fail without replacing form input.
6. Retry an identical command with the same Idempotency-Key; it must return the original record.
7. Attempt to archive a client with active branches: it must be blocked. Archive dependent branches first; history remains.
8. Provision a supervisor with exactly one branch scope. That account must not see another branch or mutate by calling the API directly.
9. Set its UserProfile.active=false through the controlled database operator procedure. Subsequent requests must be denied.
10. Sign out and verify private pages redirect to login.

## Test database

Set TEST_DATABASE_URL to an isolated database whose name ends in \_test. Apply the committed migrations using DATABASE_URL pointing to that test database, then run npm run test:integration. Fixtures use fictional names and deliberately retain audit history; destroy/reset ONLY the isolated test database afterward. The suite aborts without this explicit connection.

Playwright browser installation is a local setup action (npx playwright install chromium). This session did not bypass the prior browser URL-policy rejection by using a separate browser tool. Browser tests are delivered but cannot be claimed run here. E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD/E2E_ADMIN_DISPLAY_NAME must refer to test-only invited users, never production credentials.
## Local role autofill

The Operations login shows Admin, Supervisor, and Executive choices on the localhost development server. Roles without a configured test account open a read-only preview with sample data. To enable real test sign-in through those choices:

1. Use a local Supabase Auth instance and a local PostgreSQL database whose name ends in `_test`. Point both `DATABASE_URL` and `TEST_DATABASE_URL` to that database and set the local Supabase URL and publishable key. Keep these settings in a separate local test checkout or environment so the normal app remains connected to its intended database.
2. Use the existing setup and provisioning tools to create invited test identities and active application profiles with one role each. Give the supervisor the test client/site/unit scopes and assign sample orders to the executive for meaningful dashboard review.
3. Set `OPERATIONS_TEST_AUTOFILL=true` and populate the six `TEST_AUTOFILL_*_EMAIL` and `TEST_AUTOFILL_*_PASSWORD` values from `.env.example` in the ignored `.env.local` file. Use dedicated test passwords only.
4. Start the isolated instance with `npm run dev:test-accounts -w @shree/operations` on the loopback address and open the matching `APP_URL`. The server authenticates with Supabase and checks the profile before issuing a normal session. Test passwords stay on the server.

## Staff registration

Set `SUPABASE_SECRET_KEY` (or the existing `SUPABASE_SERVICE_ROLE_KEY`) in the Operations server environment. Keep the key out of browser variables, source control and chat.

Internal usernames and email-style logins use non-deliverable provider identifiers. Registration sends no confirmation email. Requests appear immediately in **Staff & roles**. An existing administrator must review the person, assign their roles and scopes, and activate their account. Recovery for internal logins is handled by an administrator.
