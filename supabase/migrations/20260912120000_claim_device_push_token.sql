-- Let the signed-in user claim a device Expo token even when it was
-- previously stored under a different account. Table RLS stays unchanged:
-- users can still only SELECT/UPDATE/DELETE rows they own. This helper is
-- the only extra privilege, and it only reassigns the exact token the
-- current device presents (auth.uid() is always the new owner).

create or replace function public.claim_device_push_token(
  p_expo_push_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  token text := trim(both from coalesce(p_expo_push_token, ''));
begin
  if caller is null then
    raise exception 'Not authenticated'
      using errcode = '42501';
  end if;

  if char_length(token) < 16
    or char_length(token) > 200
    or token not like 'ExponentPushToken%'
  then
    raise exception 'Invalid Expo push token'
      using errcode = '22023';
  end if;

  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'Invalid platform'
      using errcode = '22023';
  end if;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    enabled,
    updated_at
  )
  values (
    caller,
    token,
    p_platform,
    true,
    now()
  )
  on conflict (expo_push_token) do update
    set
      user_id = caller,
      platform = excluded.platform,
      enabled = true,
      updated_at = now();
end;
$$;

revoke all on function public.claim_device_push_token(text, text) from public;
revoke all on function public.claim_device_push_token(text, text) from anon;
grant execute on function public.claim_device_push_token(text, text) to authenticated;
