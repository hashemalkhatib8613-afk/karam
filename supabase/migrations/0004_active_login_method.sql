-- Exactly one method is shown on the partner login page. Admin access remains separate.
alter table public.site_settings
  add column login_method text not null default 'email'
  check (login_method in ('email', 'username', 'date'));

create or replace view public.public_login_settings as
  select site_name, tagline, login_headline, login_subtitle, theme, login_method
  from public.site_settings where id = 1;

grant select on public.public_login_settings to anon, authenticated;
