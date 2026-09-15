-- ShowSignal attendance (Interested / Going) on saved_events, plus native
-- calendar event ids. Additive. Apply to development first; production Concert
-- Finder only after review.
--
-- V1 writes native calendar ids (provider = native). Google Calendar connect
-- can reuse calendar_provider / external_calendar_event_id / calendar_added_at
-- without a new table. Going wins when merging guest → permanent accounts.

alter table public.saved_events
  add column if not exists attendance_status text not null default 'interested';
alter table public.saved_events
  add column if not exists calendar_provider text;
alter table public.saved_events
  add column if not exists external_calendar_event_id text;
alter table public.saved_events
  add column if not exists calendar_added_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_events_attendance_status_check'
      and conrelid = 'public.saved_events'::regclass
  ) then
    alter table public.saved_events
      add constraint saved_events_attendance_status_check
      check (attendance_status in ('interested', 'going'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_events_calendar_provider_check'
      and conrelid = 'public.saved_events'::regclass
  ) then
    alter table public.saved_events
      add constraint saved_events_calendar_provider_check
      check (
        calendar_provider is null
        or calendar_provider in ('native', 'google')
      );
  end if;
end $$;

create index if not exists saved_events_user_attendance_idx
  on public.saved_events (user_id, attendance_status, updated_at desc);

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

  perform pg_advisory_xact_lock(
    hashtext('merge_anonymous_account_data'),
    hashtext(least(source_user_id, target_user_id)::text)
  );
  perform pg_advisory_xact_lock(
    hashtext('merge_anonymous_account_data'),
    hashtext(greatest(source_user_id, target_user_id)::text)
  );

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
    attractions, matched_labels, attendance_status, calendar_provider,
    external_calendar_event_id, calendar_added_at, created_at, updated_at
  )
  select
    target_user_id, provider, provider_event_id, name, starts_at, local_date,
    local_time, timezone, date_status, date_label, time_label, venue_id,
    venue_name, venue_address_line, city, state, venue_state_code,
    venue_postal_code, venue_country_code, venue_latitude, venue_longitude,
    image_url, ticket_url, event_status, sale_starts_at, sale_ends_at,
    attractions, matched_labels, attendance_status, calendar_provider,
    external_calendar_event_id, calendar_added_at, created_at, updated_at
  from public.saved_events
  where user_id = source_user_id
  on conflict (user_id, provider, provider_event_id) do update set
    attendance_status = case
      when excluded.attendance_status = 'going'
        or public.saved_events.attendance_status = 'going'
        then 'going'
      else coalesce(
        excluded.attendance_status,
        public.saved_events.attendance_status,
        'interested'
      )
    end,
    calendar_provider = coalesce(
      public.saved_events.calendar_provider,
      excluded.calendar_provider
    ),
    external_calendar_event_id = coalesce(
      public.saved_events.external_calendar_event_id,
      excluded.external_calendar_event_id
    ),
    calendar_added_at = coalesce(
      public.saved_events.calendar_added_at,
      excluded.calendar_added_at
    ),
    updated_at = now();

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
    initialized_at = case
      when public.ticketmaster_watch_state.initialized_at is null
        then excluded.initialized_at
      when excluded.initialized_at is null
        then public.ticketmaster_watch_state.initialized_at
      else least(
        public.ticketmaster_watch_state.initialized_at,
        excluded.initialized_at
      )
    end,
    last_checked_at = greatest(
      public.ticketmaster_watch_state.last_checked_at,
      excluded.last_checked_at
    ),
    last_error = excluded.last_error;

  insert into public.push_tokens (
    user_id, expo_push_token, platform, enabled, created_at, updated_at
  )
  select
    target_user_id, expo_push_token, platform, enabled, created_at, updated_at
  from public.push_tokens
  where user_id = source_user_id
  on conflict (expo_push_token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    enabled = excluded.enabled,
    updated_at = now();

  delete from public.saved_items where user_id = source_user_id;
  delete from public.ticketmaster_watch_state where user_id = source_user_id;
  delete from public.push_tokens where user_id = source_user_id;
end;
$$;

revoke all on function public.merge_anonymous_account_data(uuid, uuid) from public;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from anon;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from authenticated;
grant execute on function public.merge_anonymous_account_data(uuid, uuid) to service_role;
