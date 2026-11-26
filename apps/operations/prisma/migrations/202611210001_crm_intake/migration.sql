-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'CONVERTED_TO_PICKUP', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "PickupStatus" AS ENUM ('PENDING', 'IN_QUEUE', 'GOING_FOR_PICKUP', 'REACHED_BRANCH', 'CANCELLED');

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" UUID NOT NULL,
    "branchId" UUID,
    "supervisorId" UUID,
    "contactName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "windowStart" TIMESTAMPTZ(3),
    "windowEnd" TIMESTAMPTZ(3),
    "address" TEXT NOT NULL DEFAULT '',
    "approximateItems" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupRequest" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "executiveId" UUID,
    "windowStart" TIMESTAMPTZ(3) NOT NULL,
    "windowEnd" TIMESTAMPTZ(3) NOT NULL,
    "status" "PickupStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PickupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupNotification" (
    "id" UUID NOT NULL,
    "pickupId" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "assignmentVersion" INTEGER NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppInbound" (
    "id" VARCHAR(255) NOT NULL,
    "leadId" UUID NOT NULL,
    "payload" BYTEA,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppInbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmLead_branchId_status_createdAt_idx" ON "CrmLead"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CrmLead_supervisorId_status_createdAt_idx" ON "CrmLead"("supervisorId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupRequest_leadId_key" ON "PickupRequest"("leadId");

-- CreateIndex
CREATE INDEX "PickupRequest_executiveId_status_windowStart_idx" ON "PickupRequest"("executiveId", "status", "windowStart");

-- CreateIndex
CREATE INDEX "PickupNotification_recipientId_revokedAt_readAt_createdAt_idx" ON "PickupNotification"("recipientId", "revokedAt", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PickupNotification_pickupId_assignmentVersion_key" ON "PickupNotification"("pickupId", "assignmentVersion");

-- CreateIndex
CREATE INDEX "WhatsAppInbound_leadId_idx" ON "WhatsAppInbound"("leadId");

-- CreateIndex
CREATE INDEX "WhatsAppInbound_expiresAt_idx" ON "WhatsAppInbound"("expiresAt");

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupRequest" ADD CONSTRAINT "PickupRequest_executiveId_fkey" FOREIGN KEY ("executiveId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupNotification" ADD CONSTRAINT "PickupNotification_pickupId_fkey" FOREIGN KEY ("pickupId") REFERENCES "PickupRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupNotification" ADD CONSTRAINT "PickupNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppInbound" ADD CONSTRAINT "WhatsAppInbound_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CrmLead" ADD CONSTRAINT crm_lead_valid_window CHECK (
  ("windowStart" IS NULL AND "windowEnd" IS NULL) OR
  ("windowStart" IS NOT NULL AND "windowEnd" IS NOT NULL AND "windowEnd" > "windowStart")
);
ALTER TABLE "PickupRequest" ADD CONSTRAINT pickup_valid_window CHECK ("windowEnd" > "windowStart");
ALTER TABLE "PickupRequest" ADD CONSTRAINT pickup_valid_assignment CHECK (
  status = 'CANCELLED' OR (status = 'PENDING') = ("executiveId" IS NULL)
);
DO $$
DECLARE target_table text; target_role text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['CrmLead','PickupRequest','PickupNotification','WhatsAppInbound'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', target_table);
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', target_table,target_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
