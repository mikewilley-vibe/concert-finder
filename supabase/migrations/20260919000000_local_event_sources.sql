-- Source and location metadata for approved community/Local Buzz events.
-- Existing submissions continue to work; every new field is optional.

alter table public.concerts
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_updated_at timestamptz,
  add column if not exists external_id text,
  add column if not exists ticket_url text,
  add column if not exists image_url text,
  add column if not exists venue_address_line text,
  add column if not exists state text,
  add column if not exists postal_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists timezone text;

alter table public.concerts
  drop constraint if exists concerts_latitude_check,
  add constraint concerts_latitude_check
    check (latitude is null or latitude between -90 and 90),
  drop constraint if exists concerts_longitude_check,
  add constraint concerts_longitude_check
    check (longitude is null or longitude between -180 and 180);

create unique index if not exists concerts_source_external_id_uidx
  on public.concerts (source_name, external_id)
  where source_name is not null and external_id is not null;

create index if not exists concerts_public_location_idx
  on public.concerts (latitude, longitude, event_date)
  where is_published = true;
