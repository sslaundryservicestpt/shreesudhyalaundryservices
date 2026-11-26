-- Preserve rate history. Branch contracts may only be shortened at a future cutover.
CREATE FUNCTION public.guard_rate_contract_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."branchId" IS NOT NULL
       AND NEW."endsAt" >= transaction_timestamp()
       AND NEW."endsAt" < OLD."endsAt"
       AND (to_jsonb(NEW) - 'endsAt') = (to_jsonb(OLD) - 'endsAt') THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'Rate contract history is immutable';
END;
$$;

DROP TRIGGER rate_immutable ON public."RateContract";
CREATE TRIGGER rate_immutable BEFORE UPDATE OR DELETE ON public."RateContract"
FOR EACH ROW EXECUTE FUNCTION public.guard_rate_contract_change();
