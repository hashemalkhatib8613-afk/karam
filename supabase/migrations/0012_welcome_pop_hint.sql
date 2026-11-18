-- CMS-controlled discovery hint for the poppable icons on the welcome experience.
begin;

alter table public.site_settings
  add column if not exists welcome_pop_hint_enabled boolean not null default false,
  add column if not exists welcome_pop_hint_show_on text not null default 'envelope_open'
    check (welcome_pop_hint_show_on in ('arrival', 'envelope_open', 'letter_open')),
  add column if not exists welcome_pop_hint_frequency text not null default 'once'
    check (welcome_pop_hint_frequency in ('once', 'every_visit')),
  add column if not exists welcome_pop_hint_delay_seconds int not null default 1
    check (welcome_pop_hint_delay_seconds between 0 and 30),
  add column if not exists welcome_pop_hint_prompt text not null default 'Psst… catch me before I disappear.',
  add column if not exists welcome_pop_hint_success text not null default 'The little things here carry little surprises ♡',
  add column if not exists welcome_pop_hint_version int not null default 1
    check (welcome_pop_hint_version > 0);

notify pgrst, 'reload schema';
commit;
