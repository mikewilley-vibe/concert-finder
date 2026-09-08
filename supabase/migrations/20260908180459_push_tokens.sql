-- Device Expo push tokens for permanent-account new-show alerts.
-- Additive: safe for a development database after review.
-- Do not apply to production Concert Finder until reviewed.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  expo_push_token text not null check (char_length(expo_push_token) between 16 and 200),
  platform text not null check (platform in ('ios', 'android')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expo_push_token)
);

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id)
  where enabled = true;

alter table public.push_tokens enable row level security;

drop policy if exists "Users can read their own push tokens" on public.push_tokens;
drop policy if exists "Users can insert their own push tokens" on public.push_tokens;
drop policy if exists "Users can update their own push tokens" on public.push_tokens;
drop policy if exists "Users can delete their own push tokens" on public.push_tokens;

create policy "Users can read their own push tokens"
  on public.push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own push tokens"
  on public.push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own push tokens"
  on public.push_tokens for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own push tokens"
  on public.push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.push_tokens from anon;
grant select, insert, update, delete on table public.push_tokens to authenticated;
revoke references, trigger, truncate on table public.push_tokens from authenticated;

-- Move any guest tokens onto the permanent account. Guests are not prompted
-- for remote push today; this keeps merge complete if that changes.
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
