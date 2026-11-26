# Quantity ledger boundary (design only, Phase 2)

No quantity stock or processing command is implemented in Phase 1. The catalog defines explicit PIECE or KG units and service-specific routes only.

Planned immutable movements must carry order line, unit, source bucket, destination bucket, positive exact quantity, command/entity ID, actor/time and reversal reference. Candidate buckets: pickup observation (non-stock), inward observation (non-stock), accepted available, allocated processing, QC pending, QC passed, rework, released, dispatched, acknowledged delivered, returned/disputed. Observations must not be treated as duplicate available stock.

24 collected versus 25 inward must preserve both observations and create an unresolved discrepancy; only an approved resolution establishes accepted stock. Aggregate stock availability must be locked/checked in PostgreSQL transactions, not a cross-row CHECK or floating total. Rework moves existing quantity and creates none. Unit compatibility is mandatory. Phase 2 must finalize and test exact bucket semantics before any implementation.
