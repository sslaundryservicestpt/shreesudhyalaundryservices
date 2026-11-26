# Operations interaction audit

Inventory covers interaction families identified from routes and source. A row can contain several related controls. This is not an exhaustive per-button browser crawl. Server or historical evidence does not by itself verify an authenticated UI.

| ID | Route / component | Role and controls | Expected destination or effect | Initial status / cause | Repair or verification |
| --- | --- | --- | --- | --- | --- |
| I01 | /login, AuthForm.tsx | Staff sign in | /api/auth/sign-in then role workspace | NOT_YET_VERIFIED, invited identity needed | Preserve credential-based access |
| I02 | /forgot-password, /reset-password, AuthForm.tsx | Staff recovery | Managed recovery and reset | EXTERNAL_CONFIGURATION_REQUIRED for delivery of real email | Browser can verify navigation only |
| I03 | /workspace, WorkspaceShell.tsx | Staff sidebar, menu filter, drawer, profile and sign-out | Selected authorized path or /api/auth/sign-out | NOT_YET_VERIFIED for invited-role browser journey | Verify with test-only identities |
| I04 | /workspace, app/workspace/page.tsx | All role KPI links | Matching scoped work/finance lists | NOT_YET_VERIFIED across every KPI | Existing isolated executive drilldown regression |
| I05 | /workspace/work, app/workspace/work/page.tsx | Staff filters and pagination | listWork with retained query | NOT_YET_VERIFIED across filter combinations | Verify page boundaries and selected state |
| I06 | /workspace/crm, crm.ts | Coordinator create, review, convert, assign, cancel or reschedule | /api/v1/crm | WORKING at integration boundary before this batch | Existing isolated CRM test |
| I07 | /workspace/pickups, crm.ts | Executive travel, arrival and read notice | /api/v1/crm, assigned task | WORKING at integration boundary for travel and arrival before this batch | Existing isolated CRM test |
| I08 | /workspace/pickups, pickups/page.tsx | Executive collect after CRM arrival | Persist one collected work order | WORKFLOW_BLOCKED, no CRM collection bridge or branch catalogue policy | Requires link, scoped configured particulars and transactional collection |
| I09 | /workspace/masters, MasterForm.tsx / ArchiveButton.tsx | Admin client, branch, unit, garments, services CRUD and archive | /api/v1/masters | NOT_YET_VERIFIED in authenticated browser | Isolated masters coverage, verify selectors and refresh |
| I10 | /workspace/finance?section=pricing, RatePreview.tsx | Admin rate setup and preview | Finance command and /api/v1/pricing/preview | NOT_YET_VERIFIED in browser | Verify approved date and fallback policy |
| I11 | /workspace/work/[id], work.ts | Executive legacy collection, coordinator receive and verify | /api/v1/work/[id] | WORKING at integration boundary before this batch | Existing persisted legacy work fixture |
| I12 | /workspace/work/[id], work.ts | Admin resolve discrepancy | Audit and quantity ledger | WORKING at integration boundary before this batch | Existing mismatch/adjustment regression |
| I13 | /workspace/work/[id], workflow.ts | Coordinator allocate, advance, QC and rework | Authorized movement with conservation | WORKING at integration boundary before this batch | Existing isolated journey |
| I14 | /workspace/work/[id], workflow.ts | Coordinator final verify and queue | Release approved quantities | WORKING at integration boundary before this batch | Existing isolated journey |
| I15 | /workspace/work/[id], workflow.ts | Assigned dispatch, acknowledge, fail | Delivery attempt and truthful custody | WORKFLOW_BLOCKED for accurate returns, acknowledgement or failure released stock early | Repaired with return-pending marker and retained transit |
| I16 | /workspace/work/[id], workflow.ts | Coordinator confirm physical return | Release checked return stock | MISSING_HANDLER | New RECEIVE_RETURN command, scoped control and isolated denial/release regression |
| I17 | /workspace/finance, finance.ts | Admin draft, approve, issue and download PDF | Eligible delivery reservation and immutable issued invoice | WORKING at integration boundary before this batch | Existing duplicate billing and PDF regression |
| I18 | /workspace/finance, finance.ts | Admin record, allocate, verify and reverse payment | Payment review and recognized sales | WORKFLOW_BLOCKED, recording/allocation/reversal exist, explicit verification/recognition absent | Historical receipts need approved treatment before changing balances |
| I19 | /workspace/finance, finance.ts | Admin expense approval, payment and correction | Audited approval/paid/reversal | WORKFLOW_BLOCKED for correction, basic transitions exist | Correction policy and history model still needed |
| I20 | /workspace/reports, ExportButton.tsx | Coordinator queue private export | /api/v1/reports then export status | API_ERROR, retry key was reused after filters changed | Scope key to serialized filters, keep it for retries only |
| I21 | /workspace/exports/[id], jobs.ts | Requester download private CSV | Scope-checked download with expiry | EXTERNAL_CONFIGURATION_REQUIRED for running worker | Worker and scope verified by existing isolated tests |
| I22 | /workspace/work/[id], EvidenceUpload.tsx | Assigned staff upload and download proof | Private authorized evidence | API_ERROR, changed file inherited earlier retry key | Reset key for new selection and clear successful upload form |
| I23 | /workspace/access, StaffEditor.tsx | Admin invite, change scopes, deactivate | Staff command and gated provider invite | EXTERNAL_CONFIGURATION_REQUIRED for live invite delivery | Existing staff denial tests and provider setup gap |
| I24 | /workspace/pickups, WorkspaceShell.tsx | Executive notice and deep link | Assigned task and read status | WORKING at assignment-record boundary before this batch | Authenticated browser and mark-read acceptance open |
| I25 | /demo, demo/page.tsx | Visitor role entry, task, KPI, alert and exit | Isolated sample navigation | WORKING in previous local desktop/phone test | Rerun after build |
| I26 | /api/webhooks/whatsapp, whatsapp.ts | Meta delivers signed lead | Deduplicated intake, no order | EXTERNAL_CONFIGURATION_REQUIRED for live provider | Synthetic signature and delivery tests in isolated suite |

Counts for this inventory are 26 families inspected, 9 with prior working evidence at the indicated boundary, 3 repaired, 1 newly implemented, 7 still blocked by workflow or external configuration, and 6 with no prior end-to-end verification. The authenticated browser coverage is narrower than the server coverage.

## Additional source checks

The marketing source and public frontend assets were searched for /workspace, /login and port 3002 links. No Operations entry was found in the checked paths. Marketing presentation was left alone.
