-- Lock down Supabase's auto-generated REST API (PostgREST).
-- The app talks to Postgres only through Prisma as the table owner, which RLS
-- does not apply to, so enabling RLS with no policies blocks the anon /
-- authenticated roles without affecting the app. Do NOT add FORCE ROW LEVEL
-- SECURITY: that would apply RLS to the owner and break Prisma.

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Remove the API roles' table access entirely, including for tables created later.
-- Guarded so the migration still runs on a plain Postgres without Supabase roles.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
  END IF;
END $$;
