-- KOLKATA TOURIST GUIDE
-- Repair the existing Supabase RPC definition.
-- Run this ONLY if the database still reports:
-- "cannot pass more than 100 arguments to a function"
--
-- This script removes all overloaded ktg_update_entity functions.
-- Then run SUPABASE-FINAL-SETUP.sql from the beginning so the correct
-- 4-argument JSONB function is recreated.

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as identity_args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'ktg_update_entity'
  loop
    execute format(
      'drop function if exists %I.%I(%s)',
      r.schema_name,
      r.function_name,
      r.identity_args
    );
  end loop;
end $$;

-- After this succeeds, run the complete SUPABASE-FINAL-SETUP.sql file.
