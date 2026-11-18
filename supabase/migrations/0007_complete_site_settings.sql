-- Repair existing installations that skipped the newer settings migrations.
-- Safe to run after 0006, or directly on an installation with 0001–0003.
-- Existing settings and access policies are preserved.
begin;

alter table public.site_settings
  add column if not exists login_method text not null default 'email'
    check (login_method in ('email', 'username', 'date')),
  add column if not exists shared_display_name text not null default 'session'
    check (char_length(shared_display_name) between 1 and 80);

-- Some existing installations have extra public login fields. Append the new
-- field to their current view instead of removing or reordering those fields.
do $$
declare view_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_login_settings'
      and column_name = 'login_method'
  ) then
    view_definition := rtrim(pg_get_viewdef('public.public_login_settings'::regclass, true), E';\n ');
    execute format(
      'create or replace view public.public_login_settings as
       select existing.*, settings.login_method from (%s) existing
       cross join public.site_settings settings where settings.id = 1',
      view_definition
    );
  end if;
end $$;
grant select on public.public_login_settings to anon, authenticated;

-- Restore the singleton only if it is absent; never overwrite saved choices.
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- Make the new columns available to the API as soon as this transaction commits.
notify pgrst, 'reload schema';
commit;
