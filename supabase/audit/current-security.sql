-- Read-only inventory for comparing the live Supabase project with the
-- repository migration. Run this in the Supabase SQL editor and save the
-- results before applying the migration.

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by table_name, ordinal_position;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by tablename, policyname;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by c.relname;
