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
  pg_get_userbyid(c.relowner) as table_owner,
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

select
  table_name,
  indexname as index_name,
  indexdef as index_definition
from pg_indexes
where schemaname = 'public'
  and table_name in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by table_name, indexname;

select
  relation.relname as table_name,
  constraint_row.conname as constraint_name,
  constraint_row.contype as constraint_type,
  pg_get_constraintdef(constraint_row.oid, true) as constraint_definition
from pg_constraint constraint_row
join pg_class relation on relation.oid = constraint_row.conrelid
join pg_namespace namespace_row on namespace_row.oid = relation.relnamespace
where namespace_row.nspname = 'public'
  and relation.relname in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by relation.relname, constraint_row.contype, constraint_row.conname;

select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by table_name, grantee, privilege_type;

select
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in (
    'concerts',
    'saved_items',
    'saved_events',
    'ticketmaster_watch_state'
  )
order by table_name, trigger_name, event_manipulation;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proacl as access_control,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'apply_ticketmaster_watch_check',
    'get_ticketmaster_watch_batch',
    'mark_ticketmaster_watch_state_seen',
    'merge_anonymous_account_data',
    'set_updated_at',
    'sync_ticketmaster_watch_state'
  )
order by p.proname;
