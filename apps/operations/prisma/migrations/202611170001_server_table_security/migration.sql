-- Operations data is accessed through authorized server services only.
-- Supabase default privileges also apply to Prisma's migration metadata.
DO $$
DECLARE target_role TEXT; target_table TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['_prisma_migrations','UserProfile','RoleMembership','UserScope','Client','Branch','LaundryUnit','GarmentType','ServiceCatalog','AuditLog','OutboxEvent','IdempotencyRecord'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', target_table);
    FOREACH target_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=target_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', target_table, target_role);
      END IF;
    END LOOP;
  END LOOP;
END $$;
