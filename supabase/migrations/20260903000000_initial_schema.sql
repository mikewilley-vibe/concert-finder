-- Concert Finder baseline schema (reconciled 2026-09-03 against live
-- project "Concert Finder" / cihldmomtbunpdrsbrms).
--
-- Additive: safe for a fresh development database and for the existing
-- prototype after review. DO NOT apply to production until reviewed.
--
-- Live differences intentionally preserved or handled:
-- * concerts.event_date stays timestamptz (live), not date
-- * concerts.venue / city stay nullable (live has at least one null city)
-- * saved_items.item_label stays nullable; live currently has no nulls
-- * ticketmaster_watch_state.initialized_at stays NOT NULL DEFAULT now()
-- * Existing live RLS policy names are dropped before replacements
-- * Draft update/delete keep the live permanent-user (non-anonymous) rule
-- * Broad anon grants on saved_items are revoked
-- * user_id FKs are added when missing (live has zero orphans today)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.concerts (
  id uuid primary key default gen_random_uuid(),
  artist text not null check (char_length(artist) between 1 and 120),
  venue text check (char_length(venue) <= 120),
  city text check (char_length(city) <= 80),
  event_date timestamptz,
  description text check (char_length(description) <= 600),
  created_at timestamptz not null default now(),
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null
);

alter table public.concerts
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists concerts_public_date_idx
  on public.concerts (event_date)
  where is_published = true;
create index if not exists concerts_created_by_idx
  on public.concerts (created_by, created_at desc);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null default 'concert' check (item_type in (
    'concert',
    'ticketmaster_attraction',
    'ticketmaster_venue'
  )),
  item_key text not null check (char_length(item_key) between 1 and 128),
  item_label text check (
    item_label is null or char_length(item_label) between 1 and 300
  ),
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_key)
);

-- Align live defaults / checks when the table already exists.
alter table public.saved_items
  alter column item_type set default 'concert';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_items_item_type_check'
      and conrelid = 'public.saved_items'::regclass
  ) then
    alter table public.saved_items
      add constraint saved_items_item_type_check
      check (item_type in (
        'concert',
        'ticketmaster_attraction',
        'ticketmaster_venue'
      ));
  end if;
end $$;

create index if not exists saved_items_user_type_idx
  on public.saved_items (user_id, item_type, created_at desc);

-- Ticketmaster events need their own durable snapshot. The original
-- saved_items table remains the lightweight store for follows and community
-- listing favorites.
create table if not exists public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'ticketmaster'
    check (provider in ('ticketmaster', 'community')),
  provider_event_id text not null
    check (char_length(provider_event_id) between 1 and 128),
  name text not null check (char_length(name) between 1 and 300),
  starts_at timestamptz,
  local_date date,
  local_time time,
  timezone text,
  date_label text not null default '',
  time_label text,
  venue_name text not null default '',
  city text not null default '',
  state text not null default '',
  image_url text,
  ticket_url text,
  event_status text,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_event_id)
);

create index if not exists saved_events_user_start_idx
  on public.saved_events (user_id, starts_at, local_date);

create table if not exists public.ticketmaster_watch_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in (
    'ticketmaster_attraction',
    'ticketmaster_venue'
  )),
  item_key text not null check (char_length(item_key) between 1 and 128),
  item_label text check (
    item_label is null or char_length(item_label) between 1 and 300
  ),
  known_event_ids text[] not null default '{}',
  new_event_ids text[] not null default '{}',
  initialized_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text,
  unique (user_id, item_type, item_key)
);

create index if not exists ticketmaster_watch_state_user_idx
  on public.ticketmaster_watch_state (user_id, last_checked_at desc);

-- Add missing user_id FKs on the live prototype (skipped when already present).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_items_user_id_fkey'
      and conrelid = 'public.saved_items'::regclass
  ) then
    alter table public.saved_items
      add constraint saved_items_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ticketmaster_watch_state_user_id_fkey'
      and conrelid = 'public.ticketmaster_watch_state'::regclass
  ) then
    alter table public.ticketmaster_watch_state
      add constraint ticketmaster_watch_state_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.concerts enable row level security;
alter table public.saved_items enable row level security;
alter table public.saved_events enable row level security;
alter table public.ticketmaster_watch_state enable row level security;

-- Drop BOTH live prototype names and prior migration names.
drop policy if exists "Visitors can read published concerts and their own drafts" on public.concerts;
drop policy if exists "Public can read published concerts" on public.concerts;
drop policy if exists "Visitors can submit their own draft concerts" on public.concerts;
drop policy if exists "Users can submit their own drafts" on public.concerts;
drop policy if exists "Permanent users can update their own draft concerts" on public.concerts;
drop policy if exists "Users can update their own drafts" on public.concerts;
drop policy if exists "Permanent users can delete their own draft concerts" on public.concerts;
drop policy if exists "Users can delete their own drafts" on public.concerts;

drop policy if exists "Users can create their own saved items" on public.saved_items;
drop policy if exists "Users can read their own saved items" on public.saved_items;
drop policy if exists "Users can delete their own saved items" on public.saved_items;
drop policy if exists "Users manage their own saved items" on public.saved_items;

drop policy if exists "Users manage their own saved events" on public.saved_events;

drop policy if exists "Users can read their own watch state" on public.ticketmaster_watch_state;
drop policy if exists "Users can update their own watch state" on public.ticketmaster_watch_state;
drop policy if exists "Users read their own watch state" on public.ticketmaster_watch_state;

create policy "Public can read published concerts"
  on public.concerts for select
  to anon, authenticated
  using (
    is_published = true
    or (
      (select auth.uid()) is not null
      and created_by = (select auth.uid())
    )
  );

create policy "Users can submit their own drafts"
  on public.concerts for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and is_published = false
  );

-- Preserve live behavior: only permanent (non-anonymous) users edit/delete drafts.
create policy "Users can update their own drafts"
  on public.concerts for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and is_published = false
    and coalesce(((select auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  )
  with check (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and is_published = false
    and coalesce(((select auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  );

create policy "Users can delete their own drafts"
  on public.concerts for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and created_by = (select auth.uid())
    and is_published = false
    and coalesce(((select auth.jwt() ->> 'is_anonymous')::boolean), false) is false
  );

create policy "Users manage their own saved items"
  on public.saved_items for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own saved events"
  on public.saved_events for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Clients may read watch state; mark-as-seen goes through the narrow function.
create policy "Users read their own watch state"
  on public.ticketmaster_watch_state for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants (tighten live anon privileges on saved_items)
-- ---------------------------------------------------------------------------

revoke all on table public.saved_items from anon;
revoke all on table public.ticketmaster_watch_state from anon;
revoke all on table public.saved_events from anon;

grant select on public.concerts to anon, authenticated;
grant insert, update, delete on public.concerts to authenticated;
grant select, insert, update, delete on public.saved_items to authenticated;
grant select, insert, update, delete on public.saved_events to authenticated;
grant select on public.ticketmaster_watch_state to authenticated;

-- ---------------------------------------------------------------------------
-- Functions / triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saved_events_set_updated_at on public.saved_events;
create trigger saved_events_set_updated_at
before update on public.saved_events
for each row execute function public.set_updated_at();

-- The client can clear a notification row without permission to alter the
-- checker's baselines, owner, or error state.
create or replace function public.mark_ticketmaster_watch_state_seen(target_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ticketmaster_watch_state
  set new_event_ids = '{}'
  where id::text = target_id
    and user_id = auth.uid();
$$;

revoke all on function public.mark_ticketmaster_watch_state_seen(text) from public;
grant execute on function public.mark_ticketmaster_watch_state_seen(text) to authenticated;

-- Called only by the server after it verifies both the anonymous source token
-- and the signed-in destination token. Direct browser execution is revoked.
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

  delete from public.saved_items where user_id = source_user_id;

  insert into public.saved_events (
    user_id,
    provider,
    provider_event_id,
    name,
    starts_at,
    local_date,
    local_time,
    timezone,
    date_label,
    time_label,
    venue_name,
    city,
    state,
    image_url,
    ticket_url,
    event_status,
    sale_starts_at,
    sale_ends_at,
    created_at,
    updated_at
  )
  select
    target_user_id,
    provider,
    provider_event_id,
    name,
    starts_at,
    local_date,
    local_time,
    timezone,
    date_label,
    time_label,
    venue_name,
    city,
    state,
    image_url,
    ticket_url,
    event_status,
    sale_starts_at,
    sale_ends_at,
    created_at,
    updated_at
  from public.saved_events
  where user_id = source_user_id
  on conflict (user_id, provider, provider_event_id) do nothing;

  delete from public.saved_events where user_id = source_user_id;

  update public.concerts
  set created_by = target_user_id
  where created_by = source_user_id;

  insert into public.ticketmaster_watch_state (
    user_id,
    item_type,
    item_key,
    item_label,
    known_event_ids,
    new_event_ids,
    initialized_at,
    last_checked_at,
    last_error
  )
  select
    target_user_id,
    item_type,
    item_key,
    item_label,
    known_event_ids,
    new_event_ids,
    initialized_at,
    last_checked_at,
    last_error
  from public.ticketmaster_watch_state
  where user_id = source_user_id
  on conflict (user_id, item_type, item_key) do nothing;

  delete from public.ticketmaster_watch_state where user_id = source_user_id;
end;
$$;

revoke all on function public.merge_anonymous_account_data(uuid, uuid) from public;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from anon;
revoke all on function public.merge_anonymous_account_data(uuid, uuid) from authenticated;
grant execute on function public.merge_anonymous_account_data(uuid, uuid) to service_role;
