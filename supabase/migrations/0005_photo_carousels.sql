-- Extra photos follow a lead image wherever it appears. Groups are one level deep.
create table public.media_carousel_photos (
  lead_asset_id uuid not null references public.media_assets(id) on delete cascade,
  media_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  primary key (lead_asset_id, media_id),
  check (lead_asset_id <> media_id)
);
create index on public.media_carousel_photos (media_id);

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

alter table public.media_carousel_photos enable row level security;
create policy carousel_read on public.media_carousel_photos for select to authenticated
  using (public.asset_is_directly_visible(lead_asset_id));
create policy carousel_admin on public.media_carousel_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Replace a group atomically so a failed save never loses its previous photos.
create or replace function public.set_carousel_photos(p_lead uuid, p_photos uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  perform 1 from public.media_assets where id = p_lead and kind = 'image' for update;
  if not found then raise exception 'image_required'; end if;
  if exists (select 1 from unnest(p_photos) as p(id)
    left join public.media_assets m on m.id = p.id
    where m.id is null or m.kind <> 'image' or m.id = p_lead)
  then raise exception 'invalid_carousel_photo'; end if;
  delete from public.media_carousel_photos where lead_asset_id = p_lead;
  insert into public.media_carousel_photos (lead_asset_id, media_id, sort_order)
    select p_lead, id, min(ord)::integer from unnest(p_photos) with ordinality as p(id, ord) group by id;
end
$$;
revoke all on function public.set_carousel_photos(uuid, uuid[]) from public;
grant execute on function public.set_carousel_photos(uuid, uuid[]) to authenticated;
