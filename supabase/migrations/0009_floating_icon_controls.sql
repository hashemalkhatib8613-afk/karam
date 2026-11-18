-- CMS controls for placing the falling icons and choosing their quantity.
begin;

alter table public.site_settings
  add column if not exists floating_icons_layer text not null default 'background'
    check (floating_icons_layer in ('background', 'foreground')),
  add column if not exists floating_icons_quantity text not null default 'medium'
    check (floating_icons_quantity in ('min', 'medium', 'max'));

-- The icons also appear before sign-in, so expose only these non-sensitive choices.
do $$
declare view_definition text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_login_settings'
      and column_name = 'floating_icons_layer'
  ) then
    view_definition := rtrim(pg_get_viewdef('public.public_login_settings'::regclass, true), E';\n ');
    execute format(
      'create or replace view public.public_login_settings as
       select existing.*, settings.floating_icons_layer, settings.floating_icons_quantity
       from (%s) existing
       cross join public.site_settings settings where settings.id = 1',
      view_definition
    );
  end if;
end $$;

grant select on public.public_login_settings to anon, authenticated;
notify pgrst, 'reload schema';
commit;
