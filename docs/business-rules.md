# Approved development rules / unresolved production decisions

Phase 1 only: master data and access. One legal entity is assumed for architecture only. Multiple laundry units are supported. ADMIN may manage master data globally; SUPERVISOR can read only explicit client, branch or unit scope. A scope grants its matching resource hierarchy; scopes combine as a union, not an implicit intersection. DELIVERY_EXECUTIVE has no unrestricted masters access. BRANCH_USER portal is disabled. Operators remain references for a future phase, not supervisor aliases.

Every branch references an existing active client and, if selected, active laundry unit. Active branches block archiving their parent. Archives preserve foreign keys and history. Unarchiving a branch also requires active parents. Mutations require an optimistic record version. No hard-delete endpoint is exposed.

Catalog routes: Wash/Dry/Fold, Wash/Dry/Iron, Iron-only. These are definitions, not a completed processing engine. Pieces and kilograms remain distinct; no quantity ledger or billing uses these definitions in Phase 1.

Integer minor-unit parsing is an exact helper only. Currency, currency scale, local timezone, legal entity, tax registration/calculation/rounding, invoice format/numbering, pricing date, cutoffs, POD policy, compensation, retention and backup policy are unresolved owner/accountant decisions. No finance endpoint or invoice issuance exists. Stored timestamps are UTC; UI master timestamps explicitly say UTC.

Later-phase defaults in the brief are recorded but not implemented: branch-wise billing, automatic drafts with manual Admin issue, complete-order reconciliation, no disputed/unreconciled billing, no public registration, no SMS/WhatsApp/payment integrations without separate approval.
