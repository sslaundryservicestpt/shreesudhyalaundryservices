# Shree Sudhya Laundry Services

Npm workspace containing the public marketing site and a separate private operations application. Includes secure identity/access, masters, pickup-to-delivery operations, source-based finance, reconciled reports and durable workers. See the verification and production limitations below.

| Workspace | Purpose | Development | Build |
| --- | --- | --- | --- |
| apps/marketing | Existing public site, original artwork/contact/gallery/3D | npm run dev:marketing (3001) | npm run build:marketing → apps/marketing/out |
| apps/operations | Server-enabled internal workspace | npm run dev:operations (3002) | npm run build:operations |
| packages/domain | Framework-independent access, validation and exact money helpers | — | consumed as TypeScript |

Run npm ci from root. Node 20.19+; CI uses Node 22. Run npm run db:generate after installing, then npm run check for lint, both builds, typechecks and applicable tests. npm run test:integration requires an isolated PostgreSQL database; it deliberately fails rather than pretending to verify locking without one. npm run test:browser -w @shree/operations runs the delivered Playwright journeys in an authorised environment.

See [implementation status](docs/implementation-status.md), [local setup](docs/local-setup.md), [security model](docs/security-model.md), [business decisions](docs/business-rules.md) and [release checklist](docs/release-checklist.md). Prior marketing instructions are preserved in [marketing readme](docs/marketing-readme.md).

Supabase Auth verifies identity; PostgreSQL/Prisma stores application roles, scopes and masters. Missing configuration denies access. There is no fake login, production seed password, client-side database or invented live KPI. Hosted integrations and real PostgreSQL tests require explicit local configuration. Production deployments/migrations are not run by setup or test scripts.

The existing uncommitted marketing contact improvements and unrelated output/ folder are preserved. No production data or secrets are included. The implemented core workflows and remaining limitations are described in [phase inventory](docs/phase-2-4-status.md). Start with the [operations run guide](docs/operations-guide.md).
