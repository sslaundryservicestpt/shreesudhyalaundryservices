-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "failedAt" TIMESTAMPTZ(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" UUID NOT NULL,
    "number" BIGSERIAL NOT NULL,
    "branchId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "executiveId" UUID NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "queue" TEXT NOT NULL DEFAULT 'PICKUP',
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuantityMovement" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "lineId" UUID NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "reference" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuantityMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "content" BYTEA NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPolicy" (
    "id" TEXT NOT NULL DEFAULT 'operations',
    "version" INTEGER NOT NULL DEFAULT 1,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BusinessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateContract" (
    "id" UUID NOT NULL,
    "branchId" UUID,
    "clientId" UUID,
    "garmentId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "unit" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" BIGINT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "number" TEXT,
    "currency" TEXT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "tax" BIGINT NOT NULL,
    "total" BIGINT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf" BYTEA,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAllocation" (
    "orderId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,

    CONSTRAINT "BillingAllocation_pkey" PRIMARY KEY ("orderId")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "next" BIGINT NOT NULL DEFAULT 1,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "reversedAt" TIMESTAMPTZ(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "incurredAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_number_key" ON "WorkOrder"("number");

-- CreateIndex
CREATE INDEX "WorkOrder_branchId_queue_createdAt_idx" ON "WorkOrder"("branchId", "queue", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrder_executiveId_scheduledAt_idx" ON "WorkOrder"("executiveId", "scheduledAt");

-- CreateIndex
CREATE INDEX "QuantityMovement_orderId_createdAt_idx" ON "QuantityMovement"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_orderId_idx" ON "FileAsset"("orderId");

-- CreateIndex
CREATE INDEX "RateContract_garmentId_serviceId_startsAt_idx" ON "RateContract"("garmentId", "serviceId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_clientId_status_dueAt_idx" ON "Invoice"("clientId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Payment_clientId_receivedAt_idx" ON "Payment"("clientId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- AddForeignKey
ALTER TABLE "QuantityMovement" ADD CONSTRAINT "QuantityMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAllocation" ADD CONSTRAINT "BillingAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAllocation" ADD CONSTRAINT "BillingAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Cross-aggregate references retain history; archive rather than deleting masters.
ALTER TABLE "WorkOrder" ADD CONSTRAINT work_branch_fk FOREIGN KEY ("branchId") REFERENCES "Branch"(id) ON DELETE RESTRICT;
ALTER TABLE "WorkOrder" ADD CONSTRAINT work_client_fk FOREIGN KEY ("clientId") REFERENCES "Client"(id) ON DELETE RESTRICT;
ALTER TABLE "WorkOrder" ADD CONSTRAINT work_unit_fk FOREIGN KEY ("unitId") REFERENCES "LaundryUnit"(id) ON DELETE RESTRICT;
ALTER TABLE "WorkOrder" ADD CONSTRAINT work_executive_fk FOREIGN KEY ("executiveId") REFERENCES "UserProfile"(id) ON DELETE RESTRICT;
ALTER TABLE "QuantityMovement" ADD CHECK (quantity > 0 AND "from" <> "to");
ALTER TABLE "RateContract" ADD CHECK (rate > 0 AND "endsAt" > "startsAt" AND num_nonnulls("branchId","clientId") <= 1);
ALTER TABLE "Invoice" ADD CHECK (subtotal >= 0 AND tax >= 0 AND total = subtotal + tax AND "endsAt" > "startsAt");
ALTER TABLE "Payment" ADD CHECK (amount > 0);
ALTER TABLE "PaymentAllocation" ADD CHECK (amount > 0);
ALTER TABLE "CreditNote" ADD CHECK (amount > 0);
ALTER TABLE "Expense" ADD CHECK (amount > 0);
ALTER TABLE "WorkOrder" ADD CHECK (version > 0);
CREATE TRIGGER quantity_immutable BEFORE UPDATE OR DELETE ON "QuantityMovement" FOR EACH ROW EXECUTE FUNCTION deny_audit_change();
CREATE TRIGGER rate_immutable BEFORE UPDATE OR DELETE ON "RateContract" FOR EACH ROW EXECUTE FUNCTION deny_audit_change();
CREATE TRIGGER credit_immutable BEFORE UPDATE OR DELETE ON "CreditNote" FOR EACH ROW EXECUTE FUNCTION deny_audit_change();
CREATE TRIGGER allocation_immutable BEFORE UPDATE OR DELETE ON "PaymentAllocation" FOR EACH ROW EXECUTE FUNCTION deny_audit_change();
CREATE FUNCTION protect_issued_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='ISSUED' THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Issued invoice cannot be deleted'; END IF;
   IF (to_jsonb(NEW)-'pdf') IS DISTINCT FROM (to_jsonb(OLD)-'pdf') THEN RAISE EXCEPTION 'Issued invoice is immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invoice_immutable BEFORE UPDATE OR DELETE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION protect_issued_invoice();
CREATE FUNCTION protect_payment_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Receipt cannot be deleted'; END IF;
 IF (to_jsonb(NEW)-'reversedAt'-'reversalReason') IS DISTINCT FROM (to_jsonb(OLD)-'reversedAt'-'reversalReason') OR OLD."reversedAt" IS NOT NULL THEN RAISE EXCEPTION 'Receipt is immutable; record one reversal'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receipt_immutable BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION protect_payment_receipt();
DO $$
DECLARE target_role TEXT; target_table TEXT;
BEGIN
 FOREACH target_table IN ARRAY ARRAY['WorkOrder','QuantityMovement','FileAsset','BusinessPolicy','RateContract','Invoice','BillingAllocation','DocumentSequence','Payment','PaymentAllocation','CreditNote','Expense'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',target_table);
  EXECUTE format('REVOKE ALL ON TABLE %I FROM PUBLIC',target_table);
  FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=target_role) THEN EXECUTE format('REVOKE ALL ON TABLE %I FROM %I',target_table,target_role); END IF;
  END LOOP;
 END LOOP;
END $$;
