-- EXAMPLE ONLY. Review with a database administrator; not applied by the app.
-- Provision laundry_runtime separately with a protected password and NO membership
-- in anon/authenticated. Keep migration credentials outside the web runtime.
-- RLS is enabled: grants alone are insufficient. Server-only policies below
-- deliberately delegate end-user authorization to the application services.
GRANT USAGE ON SCHEMA public TO laundry_runtime;
GRANT SELECT ON "UserProfile","RoleMembership","UserScope" TO laundry_runtime;
GRANT SELECT,INSERT,UPDATE ON "Client","Branch","LaundryUnit","GarmentType","ServiceCatalog","WorkOrder","BusinessPolicy","Invoice","DocumentSequence","Payment","Expense","OutboxEvent" TO laundry_runtime;
GRANT SELECT,INSERT ON "QuantityMovement","FileAsset","RateContract","PaymentAllocation","CreditNote","AuditLog","IdempotencyRecord" TO laundry_runtime;
GRANT SELECT,INSERT,DELETE ON "BillingAllocation" TO laundry_runtime;
GRANT USAGE,SELECT ON SEQUENCE "WorkOrder_number_seq" TO laundry_runtime;
DO $$
DECLARE t TEXT;
BEGIN
 FOREACH t IN ARRAY ARRAY['UserProfile','RoleMembership','UserScope','Client','Branch','LaundryUnit','GarmentType','ServiceCatalog','WorkOrder','BusinessPolicy','Invoice','DocumentSequence','Payment','Expense','OutboxEvent','QuantityMovement','FileAsset','RateContract','PaymentAllocation','CreditNote','AuditLog','IdempotencyRecord','BillingAllocation'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='server_runtime') THEN
   EXECUTE format('CREATE POLICY server_runtime ON public.%I TO laundry_runtime USING (true) WITH CHECK (true)',t);
  END IF;
 END LOOP;
END $$;
-- No access to _prisma_migrations. Do not grant UPDATE/DELETE on immutable history.
-- Bootstrap/provisioning commands use separate trusted operator credentials.

-- Phase 1 CRM example grants. Apply through the approved staging access review.
GRANT SELECT,INSERT,UPDATE ON "CrmLead","PickupRequest","PickupNotification","WhatsAppInbound" TO laundry_runtime;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['CrmLead','PickupRequest','PickupNotification','WhatsAppInbound'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='server_runtime') THEN
   EXECUTE format('CREATE POLICY server_runtime ON public.%I TO laundry_runtime USING (true) WITH CHECK (true)',t);
  END IF;
 END LOOP;
END $$;
