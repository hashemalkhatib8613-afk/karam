-- One CMS-controlled name for greetings and [HER_NAME] throughout the site.
alter table public.site_settings
  add column shared_display_name text not null default 'session'
  check (char_length(shared_display_name) between 1 and 80);
