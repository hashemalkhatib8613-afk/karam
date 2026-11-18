-- Just Us. — initial schema, security (RLS) and private storage policies.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Design rules enforced here, not in the browser:
--   * only authenticated users read anything; anonymous visitors see a tiny public login view
--   * partners read only LIVE (published, or scheduled-and-due) content
--   * locked / future / clue-gated note bodies are never returned
--   * private media is readable only when it is used by live content (or by an admin)

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.is_live(p_status text, p_scheduled_at timestamptz)
returns boolean language sql stable as $$
  select p_status = 'published' or (p_status = 'scheduled' and p_scheduled_at is not null and p_scheduled_at <= now())
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'partner' check (role in ('admin','partner')),
  preferences jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  welcome_version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;

-- First account ever created becomes the admin; everyone after is a partner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''),
          case when exists (select 1 from public.profiles where role = 'admin') then 'partner' else 'admin' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Partners change their own profile only through these functions (no direct UPDATE, so no role escalation).
create or replace function public.complete_onboarding() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set onboarding_completed_at = now(),
         welcome_version = coalesce((select welcome_version from public.site_settings where id = 1), 1)
  where id = auth.uid();
end $$;
create or replace function public.reset_onboarding(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.profiles set onboarding_completed_at = null where id = p_user;
end $$;
create or replace function public.update_my_profile(p_display_name text, p_preferences jsonb) returns void
language sql security definer set search_path = public as $$
  update public.profiles set display_name = left(coalesce(p_display_name, display_name), 80),
         preferences = coalesce(p_preferences, preferences) where id = auth.uid()
$$;

-- ---------------------------------------------------------------- media
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  thumb_path text,
  original_path text,
  kind text not null default 'image' check (kind in ('image','audio','video')),
  mime_type text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  width int, height int, duration_seconds numeric,
  title text not null default '', caption text not null default '', alt_text text not null default '',
  taken_at date, location_text text not null default '',
  tags text[] not null default '{}',
  focal_x numeric not null default 50 check (focal_x between 0 and 100),
  focal_y numeric not null default 50 check (focal_y between 0 and 100),
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.media_assets (kind, created_at desc);
create index on public.media_assets using gin (tags);
create trigger trg_media_updated before update on public.media_assets for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- site settings (singleton)
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Just Us.',
  tagline text not null default 'Our little corner of the universe.',
  greeting text not null default 'For [HER_NAME], with all my love.',
  login_headline text not null default 'A little world, just for us.',
  login_subtitle text not null default 'Every love story is beautiful, but this one is ours.',
  home_headline text not null default 'Our little forever.',
  home_subtitle text not null default 'Every day with you is my favorite.',
  welcome_letter text not null default 'I wanted to make you something that lasts longer than flowers…',
  welcome_signature text not null default 'yours, always',
  relationship_start_date date,
  timezone text not null default 'Asia/Amman',
  theme text not null default 'soft-romantic' check (theme in ('soft-romantic','midnight-love','vintage-memories','modern-minimal')),
  motion text not null default 'full' check (motion in ('full','reduced')),
  hero_asset_id uuid references public.media_assets(id) on delete set null,
  welcome_version int not null default 1,
  feature_flags jsonb not null default '{"replies":false,"bucket_list":false,"downloads":false}'::jsonb,
  home_sections jsonb not null default '[{"key":"hero","on":true},{"key":"counter","on":true},{"key":"song","on":true},{"key":"note","on":true},{"key":"album","on":true},{"key":"chapter","on":true}]'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1);
create trigger trg_settings_updated before update on public.site_settings for each row execute function public.set_updated_at();
alter table public.site_settings enable row level security;
create policy settings_read on public.site_settings for select to authenticated using (true);
create policy settings_admin on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Only these four non-private fields are visible before sign-in.
create view public.public_login_settings as
  select site_name, tagline, login_headline, login_subtitle, theme from public.site_settings where id = 1;
grant select on public.public_login_settings to anon, authenticated;

-- ---------------------------------------------------------------- content tables
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null, description text not null default '', category text not null default '',
  cover_asset_id uuid references public.media_assets(id) on delete set null,
  layout_type text not null default 'grid' check (layout_type in ('grid','polaroid','collage','filmstrip')),
  date_start date, date_end date, featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, published_at timestamptz, sort_order int not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.album_media (
  album_id uuid not null references public.albums(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order int not null default 0, caption text not null default '',
  primary key (album_id, media_id)
);
create index on public.album_media (album_id, sort_order);

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null, artist text not null default '',
  source_type text not null default 'link' check (source_type in ('spotify','youtube','apple','link','file')),
  source_url text, audio_asset_id uuid references public.media_assets(id) on delete set null,
  cover_asset_id uuid references public.media_assets(id) on delete set null,
  dedication text not null default '', featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, published_at timestamptz, sort_order int not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (source_url is null or source_url ~* '^https://')
);
create table public.playlists (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
  cover_asset_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.playlist_songs (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  sort_order int not null default 0, primary key (playlist_id, song_id)
);

create table public.story_chapters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null, teaser text not null default '', body text not null default '',
  event_date date, cover_asset_id uuid references public.media_assets(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, published_at timestamptz, sort_order int not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.chapter_media (
  chapter_id uuid not null references public.story_chapters(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order int not null default 0, primary key (chapter_id, media_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null, teaser text not null default '', body text not null default '',
  kind text not null default 'note' check (kind in ('note','letter','open_when','voice','special')),
  unlock_at timestamptz, requires_clue boolean not null default false,
  audio_asset_id uuid references public.media_assets(id) on delete set null,
  song_id uuid references public.songs(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, published_at timestamptz, sort_order int not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.note_secrets (
  note_id uuid primary key references public.notes(id) on delete cascade,
  clue text not null default '', answer_hash text not null
);
create table public.note_unlocks (
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unlocked_at timestamptz not null default now(), primary key (note_id, user_id)
);
create table public.note_attempts (
  id bigint generated always as identity primary key,
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
create index on public.note_attempts (user_id, note_id, at desc);

create table public.call_memories (
  id uuid primary key default gen_random_uuid(),
  title text not null, started_at timestamptz, duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  description text not null default '', call_type text not null default 'voice',
  media_asset_id uuid references public.media_assets(id) on delete set null,
  audio_asset_id uuid references public.media_assets(id) on delete set null,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.favorite_categories (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  description text not null default '', icon_name text not null default 'heart',
  display_template text not null default 'cards' check (display_template in ('cards','reveal','list')),
  cover_asset_id uuid references public.media_assets(id) on delete set null, sort_order int not null default 0
);
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.favorite_categories(id) on delete cascade,
  title text not null, body text not null default '', emoji text not null default '',
  media_asset_id uuid references public.media_assets(id) on delete set null,
  pinned boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.surprises (
  id uuid primary key default gen_random_uuid(),
  title text not null, teaser text not null default '', surprise_type text not null default 'gift'
    check (surprise_type in ('gift','envelope','countdown','gallery','quiz')),
  message text not null default '', linked_note_id uuid references public.notes(id) on delete set null,
  linked_album_id uuid references public.albums(id) on delete set null,
  unlock_at timestamptz, expires_at timestamptz, repeatable boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  scheduled_at timestamptz, sort_order int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bucket_items (
  id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
  planned_at date, completed_at timestamptz, cover_asset_id uuid references public.media_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  sort_order int not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.page_sections (
  id uuid primary key default gen_random_uuid(), page_slug text not null default 'home',
  block_type text not null, config jsonb not null default '{}'::jsonb, enabled boolean not null default true,
  starts_at timestamptz, ends_at timestamptz, sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('media','chapter','song','note','favorite')),
  target_id uuid not null, reaction_type text not null default 'heart',
  created_at timestamptz not null default now(), unique (user_id, target_type, target_id, reaction_type)
);
create table public.note_replies (
  id uuid primary key default gen_random_uuid(), note_id uuid not null references public.notes(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000), status text not null default 'visible',
  created_at timestamptz not null default now()
);
create table public.content_revisions (
  id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null,
  revision_number int not null, snapshot jsonb not null, editor_id uuid default auth.uid(), created_at timestamptz not null default now(),
  unique (entity_type, entity_id, revision_number)
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid default auth.uid(),
  action text not null, entity_type text not null default '', entity_id text not null default '',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

-- updated_at triggers + indexes on every table that has the column
do $$ declare t text; begin
  foreach t in array array['albums','songs','playlists','story_chapters','notes','call_memories','favorites','surprises','bucket_items','page_sections'] loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$s for each row execute function public.set_updated_at()', t);
    execute format('create index on public.%1$s (status, sort_order)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- visibility of private media
create or replace function public.asset_is_visible(p_asset uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.site_settings s where s.id = 1 and s.hero_asset_id = p_asset)
  or exists (select 1 from public.albums a where a.cover_asset_id = p_asset and public.is_live(a.status, a.scheduled_at))
  or exists (select 1 from public.album_media am join public.albums a on a.id = am.album_id where am.media_id = p_asset and public.is_live(a.status, a.scheduled_at))
  or exists (select 1 from public.story_chapters c where c.cover_asset_id = p_asset and public.is_live(c.status, c.scheduled_at))
  or exists (select 1 from public.chapter_media cm join public.story_chapters c on c.id = cm.chapter_id where cm.media_id = p_asset and public.is_live(c.status, c.scheduled_at))
  or exists (select 1 from public.songs s where (s.cover_asset_id = p_asset or s.audio_asset_id = p_asset) and public.is_live(s.status, s.scheduled_at))
  or exists (select 1 from public.call_memories c where (c.media_asset_id = p_asset or c.audio_asset_id = p_asset) and public.is_live(c.status, c.scheduled_at))
  or exists (select 1 from public.favorites f where f.media_asset_id = p_asset and public.is_live(f.status, f.scheduled_at))
  or exists (select 1 from public.notes n where n.audio_asset_id = p_asset and public.is_live(n.status, n.scheduled_at)
             and (n.unlock_at is null or n.unlock_at <= now())
             and (not n.requires_clue or exists (select 1 from public.note_unlocks u where u.note_id = n.id and u.user_id = auth.uid())))
$$;

alter table public.media_assets enable row level security;
create policy media_read on public.media_assets for select to authenticated using (public.asset_is_visible(id));
create policy media_admin on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- generic live-content policies
do $$ declare t text; begin
  foreach t in array array['albums','songs','playlists','story_chapters','call_memories','favorites'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_read on public.%1$I for select to authenticated using (public.is_live(status, scheduled_at))', t);
    execute format('create policy %1$s_admin on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
alter table public.bucket_items enable row level security;
create policy bucket_items_read on public.bucket_items for select to authenticated using (status = 'published');
create policy bucket_items_admin on public.bucket_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$ declare t text; begin
  foreach t in array array['favorite_categories','content_revisions','audit_logs','note_secrets','page_sections'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %1$s_admin on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
create policy favorite_categories_read on public.favorite_categories for select to authenticated using (true);
create policy page_sections_read on public.page_sections for select to authenticated
  using (status = 'published' and enabled and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

alter table public.album_media enable row level security;
create policy album_media_read on public.album_media for select to authenticated
  using (exists (select 1 from public.albums a where a.id = album_id and public.is_live(a.status, a.scheduled_at)));
create policy album_media_admin on public.album_media for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.chapter_media enable row level security;
create policy chapter_media_read on public.chapter_media for select to authenticated
  using (exists (select 1 from public.story_chapters c where c.id = chapter_id and public.is_live(c.status, c.scheduled_at)));
create policy chapter_media_admin on public.chapter_media for all to authenticated using (public.is_admin()) with check (public.is_admin());
alter table public.playlist_songs enable row level security;
create policy playlist_songs_read on public.playlist_songs for select to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and public.is_live(p.status, p.scheduled_at)));
create policy playlist_songs_admin on public.playlist_songs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- notes: the body of a locked note never leaves the database
alter table public.notes enable row level security;
create policy notes_read on public.notes for select to authenticated using (
  public.is_live(status, scheduled_at)
  and (unlock_at is null or unlock_at <= now())
  and (not requires_clue or exists (select 1 from public.note_unlocks u where u.note_id = notes.id and u.user_id = auth.uid()))
);
create policy notes_admin on public.notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.note_unlocks enable row level security;
create policy note_unlocks_read on public.note_unlocks for select to authenticated using (user_id = auth.uid() or public.is_admin());
alter table public.note_attempts enable row level security;
create policy note_attempts_admin on public.note_attempts for select to authenticated using (public.is_admin());

-- Teasers only (no body, no audio, no answer). Runs with owner rights, so it filters itself.
create view public.note_cards as
  select n.id, n.title, n.teaser, n.kind, n.unlock_at, n.sort_order, n.created_at,
    case when n.requires_clue and not exists (select 1 from public.note_unlocks u where u.note_id = n.id and u.user_id = auth.uid()) then 'pin'
         when n.unlock_at is not null and n.unlock_at > now() then 'scheduled'
         else 'unlocked' end as state,
    case when n.requires_clue and not exists (select 1 from public.note_unlocks u where u.note_id = n.id and u.user_id = auth.uid())
         then (select s.clue from public.note_secrets s where s.note_id = n.id) end as clue
  from public.notes n
  where public.is_live(n.status, n.scheduled_at) or public.is_admin();
revoke all on public.note_cards from anon, public;
grant select on public.note_cards to authenticated;

create or replace function public.set_note_clue(p_note uuid, p_clue text, p_answer text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.note_secrets (note_id, clue, answer_hash)
  values (p_note, coalesce(p_clue, ''), crypt(lower(btrim(p_answer)), gen_salt('bf')))
  on conflict (note_id) do update set clue = excluded.clue, answer_hash = excluded.answer_hash;
  update public.notes set requires_clue = true where id = p_note;
end $$;
create or replace function public.clear_note_clue(p_note uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.note_secrets where note_id = p_note;
  update public.notes set requires_clue = false where id = p_note;
end $$;

create or replace function public.unlock_note(p_note uuid, p_answer text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  if not exists (select 1 from public.notes n where n.id = p_note and public.is_live(n.status, n.scheduled_at)
                 and (n.unlock_at is null or n.unlock_at <= now())) then return false; end if;
  if (select count(*) from public.note_attempts where user_id = auth.uid() and note_id = p_note and at > now() - interval '10 minutes') >= 8
    then raise exception 'too_many_attempts'; end if;
  insert into public.note_attempts (note_id, user_id) values (p_note, auth.uid());
  select answer_hash into v_hash from public.note_secrets where note_id = p_note;
  if v_hash is null then return false; end if;
  v_ok := crypt(lower(btrim(coalesce(p_answer, ''))), v_hash) = v_hash;
  if v_ok then insert into public.note_unlocks (note_id, user_id) values (p_note, auth.uid()) on conflict do nothing; end if;
  return v_ok;
end $$;

-- ---------------------------------------------------------------- surprises: message hidden until unlocked
alter table public.surprises enable row level security;
create policy surprises_read on public.surprises for select to authenticated using (
  public.is_live(status, scheduled_at) and (unlock_at is null or unlock_at <= now()) and (expires_at is null or expires_at > now()));
create policy surprises_admin on public.surprises for all to authenticated using (public.is_admin()) with check (public.is_admin());
create view public.surprise_cards as
  select s.id, s.title, s.teaser, s.surprise_type, s.unlock_at, s.expires_at, s.repeatable,
    case when s.expires_at is not null and s.expires_at <= now() then 'expired'
         when s.unlock_at is not null and s.unlock_at > now() then 'countdown' else 'available' end as state
  from public.surprises s where public.is_live(s.status, s.scheduled_at) or public.is_admin();
revoke all on public.surprise_cards from anon, public;
grant select on public.surprise_cards to authenticated;

-- ---------------------------------------------------------------- reactions, replies, audit
alter table public.reactions enable row level security;
create policy reactions_read on public.reactions for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy reactions_insert on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

alter table public.note_replies enable row level security;
create policy replies_read on public.note_replies for select to authenticated using (
  public.is_admin() or (author_id = auth.uid() and exists (select 1 from public.notes n where n.id = note_id)));
create policy replies_insert on public.note_replies for insert to authenticated with check (
  author_id = auth.uid()
  and coalesce((select (feature_flags->>'replies')::boolean from public.site_settings where id = 1), false)
  and exists (select 1 from public.notes n where n.id = note_id));

create or replace function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_meta jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata) values (auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_meta, '{}'));
end $$;

-- ---------------------------------------------------------------- private storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/ogg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy media_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'media' and (public.is_admin() or exists (
    select 1 from public.media_assets m where (m.storage_path = storage.objects.name or m.thumb_path = storage.objects.name) and public.asset_is_visible(m.id))));
create policy media_objects_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy media_objects_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy media_objects_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------- lock down functions and anonymous access
revoke all on function public.complete_onboarding(), public.reset_onboarding(uuid), public.update_my_profile(text, jsonb),
  public.set_note_clue(uuid, text, text), public.clear_note_clue(uuid), public.unlock_note(uuid, text),
  public.write_audit(text, text, text, jsonb), public.asset_is_visible(uuid), public.is_admin() from public, anon;
grant execute on function public.complete_onboarding(), public.reset_onboarding(uuid), public.update_my_profile(text, jsonb),
  public.set_note_clue(uuid, text, text), public.clear_note_clue(uuid), public.unlock_note(uuid, text),
  public.write_audit(text, text, text, jsonb), public.asset_is_visible(uuid), public.is_admin() to authenticated;
revoke all on all tables in schema public from anon;
grant select on public.public_login_settings to anon;
