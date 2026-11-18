-- Permit private video uploads alongside the existing photo and audio types.
-- Keep the existing bucket size limit and access policies unchanged.
update storage.buckets
set allowed_mime_types = array(
  select distinct mime
  from unnest(coalesce(allowed_mime_types, array[]::text[]) ||
    array['video/mp4', 'video/webm', 'video/quicktime']) as mime
)
where id = 'media';

-- A cover card can contain a mix of photos and videos.
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
revoke all on function public.asset_is_directly_visible(uuid), public.set_carousel_photos(uuid, uuid[]) from public, anon;
grant execute on function public.set_carousel_photos(uuid, uuid[]) to authenticated;
