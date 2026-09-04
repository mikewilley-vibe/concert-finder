-- Concert Finder: transactional watch imports and RLS hardening.
--
-- Additive and idempotent where practical. Apply on a development Supabase
-- project first. Do NOT push this blindly to production Concert Finder
-- (cihldmomtbunpdrsbrms). Production migration history still needs a
-- separate, deliberate reconciliation.

-- ---------------------------------------------------------------------------
-- Public concerts: strip leftover anon table privileges, keep read-only
-- ---------------------------------------------------------------------------

revoke all on table public.concerts from anon;
grant select on public.concerts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- saved_items / saved_events: per-command policies
-- Follow/watch-state sync is insert/delete only. Event snapshots upsert.
-- ---------------------------------------------------------------------------

drop policy if exists "Users manage their own saved items" on public.saved_items;
drop policy if exists "Users can read their own saved items" on public.saved_items;
drop policy if exists "Users can insert their own saved items" on public.saved_items;
drop policy if exists "Users can delete their own saved items" on public.saved_items;

create policy "Users can read their own saved items"
  on public.saved_items for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert their own saved items"
  on public.saved_items for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own saved items"
  on public.saved_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users manage their own saved events" on public.saved_events;
drop policy if exists "Users can read their own saved events" on public.saved_events;
drop policy if exists "Users can insert their own saved events" on public.saved_events;
drop policy if exists "Users can update their own saved events" on public.saved_events;
drop policy if exists "Users can delete their own saved events" on public.saved_events;

create policy "Users can read their own saved events"
  on public.saved_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert their own saved events"
  on public.saved_events for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own saved events"
  on public.saved_events for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own saved events"
  on public.saved_events for delete
  to authenticated
  using (user_id = (select auth.uid()));

revoke update on table public.saved_items from authenticated;
grant select, insert, delete on public.saved_items to authenticated;
revoke references, trigger, truncate on table public.saved_items from authenticated;

grant select, insert, update, delete on public.saved_events to authenticated;
revoke references, trigger, truncate on table public.saved_events from authenticated;

-- ---------------------------------------------------------------------------
-- Watch queue: never-checked rows keep a null baseline
-- ---------------------------------------------------------------------------

alter table public.ticketmaster_watch_state
  alter column initialized_at drop not null;

alter table public.ticketmaster_watch_state
  alter column initialized_at drop default;

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
      user_id, item_type, item_key, item_label, initialized_at
    )
    values (new.user_id, new.item_type, new.item_key, new.item_label, null)
    on conflict (user_id, item_type, item_key) do update
      set item_label = excluded.item_label;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_ticketmaster_watch_state() from public;
revoke all on function public.sync_ticketmaster_watch_state() from anon;
revoke all on function public.sync_ticketmaster_watch_state() from authenticated;

-- Former NOT NULL DEFAULT now() marked follows as initialized before the
-- first successful Ticketmaster baseline. Clear those never-checked rows.
update public.ticketmaster_watch_state
set initialized_at = null
where last_checked_at is null;

-- ---------------------------------------------------------------------------
-- Atomic cron apply: one locked write per watch row
-- ---------------------------------------------------------------------------

create or replace function public.apply_ticketmaster_watch_check(
  target_user_id uuid,
  target_item_type text,
  target_item_key text,
  discovered_event_ids text[] default '{}',
  check_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  watch_known text[];
  watch_new text[];
  watch_initialized timestamptz;
  discovered text[];
  added text[];
  next_known text[];
  next_new text[];
begin
  if target_user_id is null
     or coalesce(btrim(target_item_type), '') = ''
     or coalesce(btrim(target_item_key), '') = '' then
    raise exception 'Watch check target is incomplete';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('apply_ticketmaster_watch_check'),
    hashtext(
      target_user_id::text
      || chr(31)
      || btrim(target_item_type)
      || chr(31)
      || btrim(target_item_key)
    )
  );

  select
    watch.known_event_ids,
    watch.new_event_ids,
    watch.initialized_at
  into watch_known, watch_new, watch_initialized
  from public.ticketmaster_watch_state as watch
  where watch.user_id = target_user_id
    and watch.item_type = btrim(target_item_type)
    and watch.item_key = btrim(target_item_key)
  for update;

  if not found then
    return jsonb_build_object('checked', 0, 'new_events', 0);
  end if;

  if check_error is not null then
    update public.ticketmaster_watch_state
    set
      last_error = check_error,
      last_checked_at = now()
    where user_id = target_user_id
      and item_type = btrim(target_item_type)
      and item_key = btrim(target_item_key);

    return jsonb_build_object('checked', 0, 'new_events', 0);
  end if;

  select coalesce(array_agg(trimmed order by first_seen), '{}')
  into discovered
  from (
    select trim(event.id) as trimmed, min(event.ordinality) as first_seen
    from unnest(coalesce(discovered_event_ids, '{}'))
      with ordinality as event(id, ordinality)
    where trim(event.id) <> ''
    group by trim(event.id)
  ) as unique_ids;

  if watch_initialized is null then
    update public.ticketmaster_watch_state
    set
      known_event_ids = discovered,
      new_event_ids = '{}',
      initialized_at = now(),
      last_error = null,
      last_checked_at = now()
    where user_id = target_user_id
      and item_type = btrim(target_item_type)
      and item_key = btrim(target_item_key);

    return jsonb_build_object('checked', 1, 'new_events', 0);
  end if;

  select coalesce(array_agg(event.id order by event.ordinality), '{}')
  into added
  from unnest(discovered) with ordinality as event(id, ordinality)
  where not (event.id = any (coalesce(watch_known, '{}')));

  next_known := coalesce(watch_known, '{}') || coalesce(added, '{}');
  next_new := coalesce(watch_new, '{}') || coalesce((
    select array_agg(event.id order by event.ordinality)
    from unnest(coalesce(added, '{}')) with ordinality as event(id, ordinality)
    where not (event.id = any (coalesce(watch_new, '{}')))
  ), '{}');

  update public.ticketmaster_watch_state
  set
    known_event_ids = next_known,
    new_event_ids = next_new,
    last_error = null,
    last_checked_at = now()
  where user_id = target_user_id
    and item_type = btrim(target_item_type)
    and item_key = btrim(target_item_key);

  return jsonb_build_object(
    'checked', 1,
    'new_events', coalesce(cardinality(added), 0)
  );
end;
$$;

revoke all on function public.apply_ticketmaster_watch_check(uuid, text, text, text[], text)
  from public;
revoke all on function public.apply_ticketmaster_watch_check(uuid, text, text, text[], text)
  from anon;
revoke all on function public.apply_ticketmaster_watch_check(uuid, text, text, text[], text)
  from authenticated;
grant execute on function public.apply_ticketmaster_watch_check(uuid, text, text, text[], text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Account merge: serialize with advisory locks; null never-checked baselines
-- ---------------------------------------------------------------------------

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

  delete from public.saved_items where user_id = source_user_id;
  delete from public.ticketmaster_watch_state where user_id = source_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Re-assert RPC execute grants (service_role-only except mark-as-seen)
-- ---------------------------------------------------------------------------

revoke all on function public.merge_anonymous_account_data(uuid, uuid) from public;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from anon;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from authenticated;
grant execute on function public.merge_anonymous_account_data(uuid, uuid) to service_role;

revoke all on function public.get_ticketmaster_watch_batch(integer) from public;
revoke all on function public.get_ticketmaster_watch_batch(integer) from anon;
revoke all on function public.get_ticketmaster_watch_batch(integer) from authenticated;
grant execute on function public.get_ticketmaster_watch_batch(integer) to service_role;

revoke all on function public.sync_ticketmaster_watch_state() from public;
revoke all on function public.sync_ticketmaster_watch_state() from anon;
revoke all on function public.sync_ticketmaster_watch_state() from authenticated;

revoke all on function public.mark_ticketmaster_watch_state_seen(text) from public;
revoke all on function public.mark_ticketmaster_watch_state_seen(text) from anon;
grant execute on function public.mark_ticketmaster_watch_state_seen(text) to authenticated;
