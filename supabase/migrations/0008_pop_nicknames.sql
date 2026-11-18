-- Names shown by the interactive decorations, including before sign-in.
begin;

alter table public.site_settings
  add column if not exists pop_nicknames text[] not null default '{}'
    check (cardinality(pop_nicknames) <= 30);

-- Append only this public setting, preserving fields added by earlier migrations.
do $$
declare view_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_login_settings'
      and column_name = 'pop_nicknames'
  ) then
    view_definition := rtrim(pg_get_viewdef('public.public_login_settings'::regclass, true), E';\n ');
    execute format(
      'create or replace view public.public_login_settings as
       select existing.*, settings.pop_nicknames from (%s) existing
       cross join public.site_settings settings where settings.id = 1',
      view_definition
    );
  end if;
end $$;
grant select on public.public_login_settings to anon, authenticated;
notify pgrst, 'reload schema';
commit;
