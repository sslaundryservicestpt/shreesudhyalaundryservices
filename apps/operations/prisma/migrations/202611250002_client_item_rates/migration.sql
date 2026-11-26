ALTER TABLE public."RateContract" ADD COLUMN "clientManaged" boolean NOT NULL DEFAULT false;
ALTER TABLE public."RateContract" ADD CONSTRAINT rate_client_managed_scope
  CHECK (NOT "clientManaged" OR ("clientId" IS NOT NULL AND "branchId" IS NULL));

CREATE OR REPLACE FUNCTION public.guard_rate_contract_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD."branchId" IS NOT NULL OR OLD."clientManaged")
       AND NEW."endsAt" >= transaction_timestamp()
       AND NEW."endsAt" < OLD."endsAt"
       AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Rate contract history is immutable';
END;
$$;
