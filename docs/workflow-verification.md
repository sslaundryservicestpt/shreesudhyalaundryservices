# Operations workflow verification

## Role walkthrough and current boundaries

| Stage | Admin | Supervisor | Executive | Evidence / limit |
| --- | --- | --- | --- | --- |
| Enquiry and assignment | Manage | Manage scoped sites | See own assignment | CRM integration exercises scoped conversion and reassignment |
| Collect | Open existing order | Open existing order | Record assigned legacy order counts | New CRM arrival still has no collection bridge |
| Inward, batches and quality | Verify, resolve and advance | Verify, process and check quality in scope | View assigned context | Existing quantity and rework integration fixtures |
| Delivery and return | Assign, release and confirm return | Confirm release and physical return in scope | Dispatch, acknowledge or report failure on assigned job | New return command is coordinator-only |
| Billing and payment | Draft, approve, issue, review PDF, allocate/reverse recorded receipt | Finance restricted | Finance restricted | Verified-payment and recognition workflow remains open |
| Expenses | Submit, approve or mark paid | Restricted | Restricted | Controlled correction/reversal remains open |
| Reports and evidence | Access as authorized | Scoped operations | Assigned evidence only | Worker required for queued artifacts |

## Manual acceptance trace

1. In CRM, create the call enquiry with branch and dates. Open it, save review, convert, then assign an active Executive. That Executive opens the notification and records travelling and arrival.
2. Use an existing assigned work order for the collection acceptance trace. Enter actual collection quantities, have the Supervisor confirm inward counts, and send mismatches for Admin resolution. A new CRM pickup cannot yet create this work order.
3. Allocate accepted stock to the route. Record each step, split QC results and reprocess rejected stock. Verify final quantities and queue delivery with an assigned executive.
4. Executive dispatches and records the recipient and actual accepted quantities. A failed or partial delivery remains in Exceptions with its undelivered quantity in transit. On actual return, coordinator checks the listed quantities and confirms receipt with a reason. Reassignment then uses released stock. Historical closed attempts without the new marker keep their existing state.
5. Admin opens the billing cycle, reviews included/excluded orders, creates the draft, approves and issues. Download the PDF after the background job completes. Verify repeat issuance and PDF retry reuse the document. Payment recording/allocation/reversal is available. Explicit Admin verification and downstream recognition have no complete workflow to test yet.
6. Submit an expense, approve and confirm payment using isolated data. Correction and reversal acceptance remain open. Run a scoped report, queue a private download, and verify its status before downloading. Test proof download as both authorized and unauthorized staff.

## Release limits

Separate test-only invited identities are needed for an authenticated desktop and mobile walkthrough. Live Meta, invitation and recovery delivery require authorized external configuration. Confirm the branch catalogue decision and financial migration treatment of historical receipts. No data migration is needed for the new optional return fields stored in the existing aggregate. Isolated tests use synthetic data and do not certify production readiness.

## Command evidence

- npm test -w @shree/domain passed all 18 tests, including failed-delivery custody and duplicate return protection.
- npm run test:integration found no pending migrations on the isolated database. The workflow, CRM and security suites passed. The overall run returned 17 passed and 7 failed after loss of test database connectivity, affecting the masters and catalog baseline suites.
- Initial npm run check stopped at a TypeScript narrowing error in the return branch. That was corrected. The next attempt hit the Windows Prisma engine file lock during integration. The subsequent check was started after that database run ended.

### Final verification retry

- npm run check passed. It ran lint, both builds, workspace type checks, marketing regression scripts, 25 Operations tests and 18 domain tests.
- npm run test:browser -w @shree/operations -- --workers=1 passed six public desktop and phone checks. Two invited Admin cases were skipped. This run did not visually verify live custody and finance forms.
- npm run test:integration passed all 24 isolated PostgreSQL tests on the serial retry. No pending migrations. The return regression verifies stock stays in transit, the executive is denied receipt, reassignment is blocked and the coordinator can release stock after physical confirmation.
- The local Operations preview was restarted. /demo and its stylesheet both returned HTTP 200.
