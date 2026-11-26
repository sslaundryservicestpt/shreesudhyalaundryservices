# Staging / release checklist

- Inspect configured database target and use a restricted application role separate from migration ownership.
- Run npm ci, npm run check and the real PostgreSQL integration suite.
- Configure Supabase Auth and permitted redirects, disable public signup, review rate limits/MFA/password policy.
- Bootstrap invited verified Admin through the one-off local CLI. No test identities in production.
- Exercise Admin client/two-branch/catalog persistence, supervisor scope denial, disabled user, concurrent edit and idempotent retry.
- Test desktop, tablet and executive phone navigation; native drawer focus loop and Escape; empty/search/error states; long names; reduced motion and zoom.
- Run browser tests only in authorised test environments.
- Apply migrations to staging, back up before production; obtain explicit approval before production migrations or deployment.
- Confirm currency/timezone/tax/pricing/POD/retention/numbering decisions before finance work.
- Review private database-backed evidence limits, worker leases/retries, PDF rendering and CSV expiry in staging. Evidence is not a Supabase Storage bucket integration.
- Run worker under a process supervisor and monitor failed jobs. Scheduled drafts never issue invoices automatically.
- Review supported single-rate tax/continuous numbering and credit-adjustment limitations with the accountant. Do not approve formats that are not legally suitable.

## Backup / restore procedure (not rehearsed in this session)

An authorised database operator should use pg_dump --format=custom with a protected connection to an encrypted, access-controlled backup location, including the relevant schema/audit data. Test pg_restore into a separate staging database; verify constraints, row counts, role memberships, audit immutability and application read/mutation smoke tests. Record duration, recovery point, retention and access policy. Never restore over production without separate approval. Supabase Auth identities/storage backup require provider-specific procedures and are not covered by a PostgreSQL dump alone.
