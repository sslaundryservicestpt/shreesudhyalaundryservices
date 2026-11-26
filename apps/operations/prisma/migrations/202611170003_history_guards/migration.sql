-- Protect the source links as well as the issued document snapshot.
CREATE FUNCTION protect_billing_sources() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP IN ('UPDATE','DELETE') THEN
  IF EXISTS(SELECT 1 FROM "Invoice" WHERE id=OLD."invoiceId" AND status='ISSUED') THEN RAISE EXCEPTION 'Issued billing sources are immutable'; END IF;
 END IF;
 IF TG_OP IN ('UPDATE','INSERT') THEN
  IF EXISTS(SELECT 1 FROM "Invoice" WHERE id=NEW."invoiceId" AND status='ISSUED') THEN RAISE EXCEPTION 'Cannot add sources to an issued invoice'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER issued_sources_immutable BEFORE INSERT OR UPDATE OR DELETE ON "BillingAllocation" FOR EACH ROW EXECUTE FUNCTION protect_billing_sources();
ALTER TABLE "QuantityMovement" ADD CONSTRAINT quantity_unit_valid CHECK (unit IN ('PIECE','KG') AND (unit <> 'PIECE' OR quantity % 1000 = 0));
ALTER TABLE "QuantityMovement" ADD CONSTRAINT quantity_buckets_valid CHECK ("from" IN ('EXTERNAL','AVAILABLE','PROCESSING','QC','REWORK','PASSED','RELEASED','TRANSIT','DELIVERED') AND "to" IN ('AVAILABLE','PROCESSING','QC','REWORK','PASSED','RELEASED','TRANSIT','DELIVERED'));
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_state_valid CHECK (status IN ('DRAFT','APPROVED','ISSUED','CANCELLED') AND (status <> 'ISSUED' OR (number IS NOT NULL AND "issuedAt" IS NOT NULL)));
ALTER TABLE "Payment" ADD CONSTRAINT reversal_reason_required CHECK (("reversedAt" IS NULL) = ("reversalReason" IS NULL));
ALTER TABLE "Expense" ADD CONSTRAINT expense_state_valid CHECK (status IN ('SUBMITTED','APPROVED','PAID','REJECTED'));
