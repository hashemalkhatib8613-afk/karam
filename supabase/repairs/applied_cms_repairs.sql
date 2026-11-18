-- Applied CMS repairs for Karam and Roaya (fqmxjtgpzorbvpvzesjl).
-- Historical record exported from the database migration history.
-- Already applied on 18 November 2026; do not rerun on that database.
-- Not part of the fresh-install migration sequence: the original migrations
-- already define these application policies and functions.

-- Migration 20261118120702: restore_cms_content_save_policies
begin;
create policy albums_admin on public.albums for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy stories_admin on public.story_chapters for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy notes_admin on public.notes for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy songs_admin on public.songs for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy surprises_admin on public.surprises for all to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.write_audit(p_action text,p_entity_type text,p_entity_id text,p_meta jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
if not public.is_admin() then raise exception 'forbidden'; end if;
insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(auth.uid(),p_action,p_entity_type,p_entity_id,coalesce(p_meta,'{}'::jsonb));
end $$;
revoke all on function public.write_audit(text,text,text,jsonb) from public,anon;
grant execute on function public.write_audit(text,text,text,jsonb) to authenticated;
create policy audit_logs_admin on public.audit_logs for select to authenticated using(public.is_admin());
notify pgrst,'reload schema';
commit;

-- Migration 20261118120749: restore_published_content_visibility
begin;
create or replace function public.is_live(p_status text,p_scheduled_at timestamptz) returns boolean language sql stable set search_path=public as $$
select p_status='published' or(p_status='scheduled' and p_scheduled_at is not null and p_scheduled_at<=now())
$$;
create policy albums_read on public.albums for select to authenticated using(public.is_live(status,scheduled_at));
create policy stories_read on public.story_chapters for select to authenticated using(public.is_live(status,scheduled_at));
create policy songs_read on public.songs for select to authenticated using(public.is_live(status,scheduled_at));
create policy note_unlocks_read on public.note_unlocks for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy notes_read on public.notes for select to authenticated using(
public.is_live(status,scheduled_at) and(unlock_at is null or unlock_at<=now())
and(not requires_clue or exists(select 1 from public.note_unlocks u where u.note_id=notes.id and u.user_id=auth.uid())));
create policy surprises_read on public.surprises for select to authenticated using(
public.is_live(status,scheduled_at) and(unlock_at is null or unlock_at<=now()) and(expires_at is null or expires_at>now()));
create view public.note_cards as
select n.id,n.title,n.teaser,n.kind,n.unlock_at,n.sort_order,n.created_at,
case when n.requires_clue and not exists(select 1 from public.note_unlocks u where u.note_id=n.id and u.user_id=auth.uid()) then 'pin'
when n.unlock_at is not null and n.unlock_at>now() then 'scheduled' else 'unlocked' end as state,
case when n.requires_clue and not exists(select 1 from public.note_unlocks u where u.note_id=n.id and u.user_id=auth.uid())
then(select s.clue from public.note_secrets s where s.note_id=n.id) end as clue
from public.notes n where public.is_live(n.status,n.scheduled_at) or public.is_admin();
create view public.surprise_cards as
select s.id,s.title,s.teaser,s.surprise_type,s.unlock_at,s.expires_at,s.repeatable,
case when s.expires_at is not null and s.expires_at<=now() then 'expired'
when s.unlock_at is not null and s.unlock_at>now() then 'countdown' else 'available' end as state
from public.surprises s where public.is_live(s.status,s.scheduled_at) or public.is_admin();
revoke all on public.note_cards,public.surprise_cards from public,anon;
grant select on public.note_cards,public.surprise_cards to authenticated;
notify pgrst,'reload schema';
commit;

-- Migration 20261118120808: restore_cms_media_saves
begin;
create or replace function public.asset_is_directly_visible(p_asset uuid) returns boolean
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

create or replace function public.asset_is_visible(p_asset uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.asset_is_directly_visible(p_asset) or exists (
    select 1 from public.media_carousel_photos cp
    where cp.media_id = p_asset and public.asset_is_directly_visible(cp.lead_asset_id)
  )
$$;

create policy media_read on public.media_assets for select to authenticated using (public.asset_is_visible(id));

create policy media_admin on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- generic live-content policies

create policy album_media_read on public.album_media for select to authenticated
  using (exists (select 1 from public.albums a where a.id = album_id and public.is_live(a.status, a.scheduled_at)));

create policy album_media_admin on public.album_media for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy chapter_media_read on public.chapter_media for select to authenticated
  using (exists (select 1 from public.story_chapters c where c.id = chapter_id and public.is_live(c.status, c.scheduled_at)));

create policy chapter_media_admin on public.chapter_media for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy media_objects_read on storage.objects for select to authenticated using (
  bucket_id = 'media' and (public.is_admin() or exists (
    select 1 from public.media_assets m where (m.storage_path = storage.objects.name or m.thumb_path = storage.objects.name) and public.asset_is_visible(m.id))));

create policy media_objects_insert on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());

create policy media_objects_update on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());

create policy media_objects_delete on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- ---------------------------------------------------------------- lock down functions and anonymous access

create policy carousel_read on public.media_carousel_photos for select to authenticated
  using (public.asset_is_directly_visible(lead_asset_id));

create policy carousel_admin on public.media_carousel_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Replace a group atomically so a failed save never loses its previous photos.

create or replace function public.set_carousel_photos(p_lead uuid, p_photos uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  perform 1 from public.media_assets where id = p_lead and kind in ('image', 'video') for update;
  if not found then raise exception 'visual_media_required'; end if;
  if exists (select 1 from unnest(p_photos) as p(id)
    left join public.media_assets m on m.id = p.id
    where m.id is null or m.kind not in ('image', 'video') or m.id = p_lead)
  then raise exception 'invalid_carousel_media'; end if;
  delete from public.media_carousel_photos where lead_asset_id = p_lead;
  insert into public.media_carousel_photos (lead_asset_id, media_id, sort_order)
    select p_lead, id, min(ord)::integer from unnest(p_photos) with ordinality as p(id, ord) group by id;
end
$$;

revoke all on function public.asset_is_directly_visible(uuid),public.asset_is_visible(uuid),public.set_carousel_photos(uuid,uuid[]) from public,anon;

grant execute on function public.asset_is_visible(uuid),public.set_carousel_photos(uuid,uuid[]) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('media','media',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/ogg','video/mp4','video/webm','video/quicktime']) on conflict(id) do nothing;

notify pgrst,'reload schema';
commit;

-- Migration 20261118120843: restore_cms_note_clue_saves
begin;
create extension if not exists pgcrypto with schema extensions;

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

create policy note_secrets_admin on public.note_secrets for select to authenticated using(public.is_admin());

revoke all on function public.set_note_clue(uuid,text,text),public.clear_note_clue(uuid),public.unlock_note(uuid,text) from public,anon;

grant execute on function public.set_note_clue(uuid,text,text),public.clear_note_clue(uuid),public.unlock_note(uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;

-- Migration 20261118121005: restore_cms_bucket_list_saves
begin;
create policy bucket_items_admin on public.bucket_items for all to authenticated using(public.is_admin()) with check(public.is_admin()); create policy bucket_items_read on public.bucket_items for select to authenticated using(status='published'); notify pgrst,'reload schema';
commit;
