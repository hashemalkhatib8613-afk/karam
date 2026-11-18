-- Admin: set / change the secret date, choose who it opens, switch it on or off.
-- The date is stored hashed and can never be read back. It can only open a PARTNER account, never an admin.
create or replace function public.set_date_login(p_user uuid, p_date text, p_enabled boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_date text := nullif(btrim(coalesce(p_date, '')), '');
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if v_date is not null then
    if v_date !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'bad_date'; end if;
    perform v_date::date;
  end if;
  if p_user is not null and not exists (select 1 from public.profiles where id = p_user and role = 'partner') then
    raise exception 'partner_only';
  end if;
  update public.date_login set
    user_id = coalesce(p_user, user_id),
    date_hash = case when v_date is null then date_hash else crypt(v_date, gen_salt('bf')) end,
    enabled = coalesce(p_enabled, false) and coalesce(p_user, user_id) is not null and (v_date is not null or date_hash is not null),
    updated_at = now()
  where id = 1;
end $$;

create or replace function public.date_login_status() returns table (is_enabled boolean, target_user uuid, has_date boolean, changed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select d.enabled, d.user_id, d.date_hash is not null, d.updated_at from public.date_login d where d.id = 1;
end $$;

-- Server only (service role): check a date. Limits: 5 wrong tries per 15 min per visitor, 20 wrong tries per hour overall.
create or replace function public.verify_date_login(p_date text, p_ip text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text := encode(digest(coalesce(nullif(p_ip, ''), 'unknown'), 'sha256'), 'hex');
  v_row public.date_login%rowtype;
  v_ok boolean := false;
begin
  if (select count(*) from public.login_attempts where ip_hash = v_ip and not ok and at > now() - interval '15 minutes') >= 5
     or (select count(*) from public.login_attempts where not ok and at > now() - interval '1 hour') >= 20 then
    raise exception 'too_many_attempts';
  end if;
  select * into v_row from public.date_login where id = 1;
  if v_row.enabled and v_row.date_hash is not null and v_row.user_id is not null
     and coalesce(p_date, '') ~ '^\d{4}-\d{2}-\d{2}$'
     and crypt(p_date, v_row.date_hash) = v_row.date_hash
     and exists (select 1 from public.profiles where id = v_row.user_id and role = 'partner') then
    v_ok := true;
  end if;
  insert into public.login_attempts (ip_hash, ok) values (v_ip, v_ok);
  return case when v_ok then v_row.user_id end;
end $$;

-- Server only (service role): username -> email for the sign-in form.
create or replace function public.lookup_login_email(p_username text) returns text
language sql stable security definer set search_path = public, auth as $$
  select u.email from auth.users u join public.profiles p on p.id = u.id where p.username = lower(btrim(p_username)) limit 1
$$;

revoke all on function public.set_date_login(uuid, text, boolean), public.date_login_status(),
  public.verify_date_login(text, text), public.lookup_login_email(text) from public, anon, authenticated;
grant execute on function public.set_date_login(uuid, text, boolean), public.date_login_status() to authenticated;
grant execute on function public.verify_date_login(text, text), public.lookup_login_email(text) to service_role;
