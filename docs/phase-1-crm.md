# Phase 1 CRM acceptance

## Staff walkthrough

1. Sign in as an invited, scoped Supervisor. Go to **CRM & pickups**, log a customer call, choose the client site and record the contact, address and pickup window in Tirupati time.
2. Open **New enquiries**, review the record, save the review and approve it. The request appears under **Pickup requests**. Assign an active delivery executive. Reassign, reschedule or cancel when needed. Rescheduling, cancellation, rejection and closing require a reason.
3. Sign in as the assigned Executive. Open **Assigned pickups** or use the **New pickup assigned.** link on the dashboard. Confirm the site contact, directions and instructions. Start travel and record arrival. Check that another executive cannot open the same link. Reassignment revokes the old notification and issues one to the new executive.
4. Existing collected orders continue through receiving, verification and delivery using their work-order pages. New CRM requests end at branch arrival in Phase 1. Phase 2 will create the work order transactionally on actual collection. The previous direct work-creation API returns HTTP 410 and directs clients to CRM. Existing work reads and commands remain available.
5. From sign-in choose **Explore Demo Dashboard**. Try all three role previews and sample records. These use fixture data inside /demo and do not sign in or make business requests.

## WhatsApp

The endpoint is GET/POST /api/webhooks/whatsapp. Enable it only after the five operations migrations and reviewed runtime grants are installed in authorized staging. Set the server-only environment values shown in apps/operations/.env.example. A signed subscription must target the configured business phone number. Sender matching accepts only a single active branch match. Ambiguous or unknown senders go to the administrator and the optional designated supervisor for manual site selection. The designated supervisor still needs scope on the destination site. Each distinct provider message yields one reviewable lead. Duplicate delivery returns success without creating another lead. Inbound messages never make pickup requests, work orders or invoices.

Raw request bytes are retained for up to 24 hours plus the time until the next successful worker sweep. Keep the worker supervised and verify retention monitoring before enabling the integration. Provider message identifiers remain for deduplication. Message details retained on the lead follow the business record retention policy. Keep the integration off until Meta subscription, valid/invalid challenge, signed delivery, replay and retention have been verified with the authorized owner account. Local database tests use a test signing key and synthetic payload. [Meta webhook reference](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/)

## Security and release boundaries

| Boundary | Coverage |
| --- | --- |
| Scope | Coordinator writes and replays recheck persisted active role and branch/client/unit scope. Unmatched intake is visible only to authorized Admins and the designated intake Supervisor. |
| Executive access | Reads require current assignment. An executive receives only field details and instructions. Internal CRM notes remain in the coordinator view. Reassignment and cancellation revoke previous notifications in the assignment transaction. |
| Replay and audit | CRM commands use the existing request hash, key and serializable transaction. A unique lead-to-pickup link protects conversion. Staff actions are audited without recording full form contents again. Inbound events retain their own provider receipt and lead association. |
| Isolation | Demo controls point to fictional records. The live CRM uses persisted data. Browser roles receive no new database grants. |
| Finance | Phase 1 leaves invoice, payment and pricing services in place. CRM lead and pickup writes create no billable sources. The new master specification's verified-payment sales-recognition rule remains a later finance phase. |

Migration 202611210001_crm_intake adds CrmLead, PickupRequest, PickupNotification and WhatsAppInbound. Historical SQL is preserved. Apply the new migration and the reviewed example server role policies only in an authorized environment. Run staff acceptance with invited role identities and a separate test database. Production deployment is outside this phase.

## Verification completed

- npm run check passed. This included lint, both production builds, workspace type checking, the marketing checks, 25 Operations tests and 18 domain tests. The standalone marketing and Operations build commands also passed during the phase.
- npm run test:integration passed all 23 tests. The fifth migration was applied to the isolated test database and the rerun reported no pending migrations.
- npm run test:browser -w @shree/operations -- --workers=1 --timeout=90000 passed six desktop and phone tests against the built local app. Two invited-Admin cases were skipped because isolated browser login credentials were not supplied. Anonymous access, login/recovery and the demo's lack of business API calls were exercised.
- Live Meta delivery and authenticated staff browser acceptance remain unverified. No production migration or deployment was performed.

## Phase 1 verification rerun

- Isolated PostgreSQL reported all five migrations present and none pending. All 23 integration tests passed, including scoped CRM conversion, assignment and revocation, replay and audit, and synthetic WhatsApp signatures, deduplication and payload expiry.
- All six selected public desktop and phone checks passed against the local built app. These covered anonymous access, sign-in and recovery navigation, and demo isolation. Authenticated journeys were excluded.
- Staging acceptance remains open. An isolated staging app with invited Supervisor and Executive identities is required for the authenticated CRM journey. Live Meta delivery requires an authorized test subscription. No application database migration, deployment or external message was performed.
