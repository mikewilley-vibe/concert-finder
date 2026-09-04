-- Concert Finder Phase 2: native-ready event snapshots and rotating watch queue.
--
-- Apply only after 20260903000000_initial_schema.sql has been reconciled with
-- the target database. This migration is additive and preserves the audited
-- Phase 1 RLS policies and grants.

alter table public.saved_events add column if not exists venue_id text;
alter table public.saved_events
  add column if not exists date_status text not null default 'scheduled';
alter table public.saved_events add column if not exists venue_address_line text;
alter table public.saved_events add column if not exists venue_postal_code text;
alter table public.saved_events add column if not exists venue_state_code text;
alter table public.saved_events add column if not exists venue_country_code text;
alter table public.saved_events add column if not exists venue_latitude double precision;
alter table public.saved_events add column if not exists venue_longitude double precision;
alter table public.saved_events
  add column if not exists attractions jsonb not null default '[]'::jsonb;
alter table public.saved_events
  add column if not exists matched_labels text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_events_date_status_check'
      and conrelid = 'public.saved_events'::regclass
  ) then
    alter table public.saved_events
      add constraint saved_events_date_status_check
      check (date_status in ('scheduled', 'date_tba', 'date_tbd'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_events_venue_latitude_check'
      and conrelid = 'public.saved_events'::regclass
  ) then
    alter table public.saved_events
      add constraint saved_events_venue_latitude_check
      check (venue_latitude is null or venue_latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_events_venue_longitude_check'
      and conrelid = 'public.saved_events'::regclass
  ) then
    alter table public.saved_events
      add constraint saved_events_venue_longitude_check
      check (venue_longitude is null or venue_longitude between -180 and 180);
  end if;
end $$;

-- Keep one queue row for each Ticketmaster follow. Client writes continue to
-- be limited to saved_items by RLS; this trigger maintains the service queue.
create or replace function public.sync_ticketmaster_watch_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.item_type in ('ticketmaster_attraction', 'ticketmaster_venue') then
      delete from public.ticketmaster_watch_state
      where user_id = old.user_id
        and item_type = old.item_type
        and item_key = old.item_key;
    end if;
    return old;
  end if;

  if new.item_type in ('ticketmaster_attraction', 'ticketmaster_venue') then
    insert into public.ticketmaster_watch_state (
      user_id, item_type, item_key, item_label
    )
    values (new.user_id, new.item_type, new.item_key, new.item_label)
    on conflict (user_id, item_type, item_key) do update
      set item_label = excluded.item_label;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_ticketmaster_watch_state() from public;
revoke all on function public.sync_ticketmaster_watch_state() from anon;
revoke all on function public.sync_ticketmaster_watch_state() from authenticated;

drop trigger if exists saved_items_sync_ticketmaster_watch_state
  on public.saved_items;
create trigger saved_items_sync_ticketmaster_watch_state
after insert or delete on public.saved_items
for each row execute function public.sync_ticketmaster_watch_state();

insert into public.ticketmaster_watch_state (
  user_id, item_type, item_key, item_label
)
select user_id, item_type, item_key, item_label
from public.saved_items
where item_type in ('ticketmaster_attraction', 'ticketmaster_venue')
on conflict (user_id, item_type, item_key) do update
  set item_label = excluded.item_label;

-- Service-only work queue. Least-recently checked permanent-account follows
-- are returned first so bounded serverless runs rotate through all users.
create or replace function public.get_ticketmaster_watch_batch(
  requested_limit integer default 40
)
returns table (
  user_id uuid,
  item_type text,
  item_key text,
  item_label text,
  known_event_ids text[],
  new_event_ids text[],
  initialized_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    watch.user_id,
    watch.item_type,
    watch.item_key,
    coalesce(watch.item_label, watch.item_key),
    watch.known_event_ids,
    watch.new_event_ids,
    watch.initialized_at
  from public.ticketmaster_watch_state as watch
  inner join auth.users as account on account.id = watch.user_id
  where account.is_anonymous is false
  order by watch.last_checked_at asc nulls first, watch.id asc
  limit least(greatest(requested_limit, 1), 100);
$$;

revoke all on function public.get_ticketmaster_watch_batch(integer) from public;
revoke all on function public.get_ticketmaster_watch_batch(integer) from anon;
revoke all on function public.get_ticketmaster_watch_batch(integer) from authenticated;
grant execute on function public.get_ticketmaster_watch_batch(integer) to service_role;

-- Refresh account transfer so native-ready event fields and queue history move
-- with an anonymous user when they create or sign into a permanent account.
create or replace function public.merge_anonymous_account_data(
  source_user_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if source_user_id = target_user_id then
    raise exception 'Source and target accounts must be different';
  end if;

  if not exists (
    select 1 from auth.users
    where id = source_user_id and is_anonymous = true
  ) then
    raise exception 'Source account is not anonymous';
  end if;

  if not exists (
    select 1 from auth.users
    where id = target_user_id and is_anonymous = false
  ) then
    raise exception 'Target account is not permanent';
  end if;

  insert into public.saved_items (
    user_id, item_type, item_key, item_label, created_at
  )
  select target_user_id, item_type, item_key, item_label, created_at
  from public.saved_items
  where user_id = source_user_id
  on conflict (user_id, item_type, item_key) do nothing;

  insert into public.saved_events (
    user_id, provider, provider_event_id, name, starts_at, local_date,
    local_time, timezone, date_status, date_label, time_label, venue_id,
    venue_name, venue_address_line, city, state, venue_state_code,
    venue_postal_code, venue_country_code, venue_latitude, venue_longitude,
    image_url, ticket_url, event_status, sale_starts_at, sale_ends_at,
    attractions, matched_labels, created_at, updated_at
  )
  select
    target_user_id, provider, provider_event_id, name, starts_at, local_date,
    local_time, timezone, date_status, date_label, time_label, venue_id,
    venue_name, venue_address_line, city, state, venue_state_code,
    venue_postal_code, venue_country_code, venue_latitude, venue_longitude,
    image_url, ticket_url, event_status, sale_starts_at, sale_ends_at,
    attractions, matched_labels, created_at, updated_at
  from public.saved_events
  where user_id = source_user_id
  on conflict (user_id, provider, provider_event_id) do nothing;

  delete from public.saved_events where user_id = source_user_id;

  update public.concerts
  set created_by = target_user_id
  where created_by = source_user_id;

  insert into public.ticketmaster_watch_state (
    user_id, item_type, item_key, item_label, known_event_ids, new_event_ids,
    initialized_at, last_checked_at, last_error
  )
  select
    target_user_id, item_type, item_key, item_label, known_event_ids,
    new_event_ids, initialized_at, last_checked_at, last_error
  from public.ticketmaster_watch_state
  where user_id = source_user_id
  on conflict (user_id, item_type, item_key) do update set
    item_label = excluded.item_label,
    known_event_ids = (
      select coalesce(array_agg(distinct event_id), '{}')
      from unnest(
        public.ticketmaster_watch_state.known_event_ids || excluded.known_event_ids
      ) as event_id
    ),
    new_event_ids = (
      select coalesce(array_agg(distinct event_id), '{}')
      from unnest(
        public.ticketmaster_watch_state.new_event_ids || excluded.new_event_ids
      ) as event_id
    ),
    initialized_at = least(
      public.ticketmaster_watch_state.initialized_at,
      excluded.initialized_at
    ),
    last_checked_at = greatest(
      public.ticketmaster_watch_state.last_checked_at,
      excluded.last_checked_at
    ),
    last_error = excluded.last_error;

  delete from public.saved_items where user_id = source_user_id;
  delete from public.ticketmaster_watch_state where user_id = source_user_id;
end;
$$;

revoke all on function public.merge_anonymous_account_data(uuid, uuid) from public;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from anon;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from authenticated;
grant execute on function public.merge_anonymous_account_data(uuid, uuid) to service_role;
