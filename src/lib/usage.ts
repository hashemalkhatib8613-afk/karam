import type { SupabaseClient } from "@supabase/supabase-js";

export type Usage = { kind: string; title: string; href: string };

/** Everything that references a media asset. Deleting is blocked while this is non-empty. */
export async function assetUsage(supabase: SupabaseClient, id: string): Promise<Usage[]> {
  const q = (table: string, col: string, select: string) => supabase.from(table).select(select).eq(col, id);
  const [am, ac, cm, cc, sc, sa, nt, cl, fv, st, cp] = await Promise.all([
    supabase.from("album_media").select("albums(id,title)").eq("media_id", id),
    q("albums", "cover_asset_id", "id,title"),
    supabase.from("chapter_media").select("story_chapters(id,title)").eq("media_id", id),
    q("story_chapters", "cover_asset_id", "id,title"),
    q("songs", "cover_asset_id", "id,title"),
    q("songs", "audio_asset_id", "id,title"),
    q("notes", "audio_asset_id", "id,title"),
    supabase.from("call_memories").select("id,title").or(`media_asset_id.eq.${id},audio_asset_id.eq.${id}`),
    q("favorites", "media_asset_id", "id,title"),
    q("site_settings", "hero_asset_id", "id"),
    q("media_carousel_photos", "media_id", "lead_asset_id"),
  ]);
  const out: Usage[] = [];
  (am.data ?? []).forEach((r: any) => r.albums && out.push({ kind: "Album", title: r.albums.title, href: `/admin/albums/${r.albums.id}` }));
  (ac.data ?? []).forEach((r: any) => out.push({ kind: "Album cover", title: r.title, href: `/admin/albums/${r.id}` }));
  (cm.data ?? []).forEach((r: any) => r.story_chapters && out.push({ kind: "Chapter", title: r.story_chapters.title, href: `/admin/stories/${r.story_chapters.id}` }));
  (cc.data ?? []).forEach((r: any) => out.push({ kind: "Chapter cover", title: r.title, href: `/admin/stories/${r.id}` }));
  [...(sc.data ?? []), ...(sa.data ?? [])].forEach((r: any) => out.push({ kind: "Song", title: r.title, href: `/admin/songs/${r.id}` }));
  (nt.data ?? []).forEach((r: any) => out.push({ kind: "Note recording", title: r.title, href: `/admin/notes/${r.id}` }));
  (cl.data ?? []).forEach((r: any) => out.push({ kind: "Call memory", title: r.title, href: "/admin" }));
  (fv.data ?? []).forEach((r: any) => out.push({ kind: "Favorite", title: r.title, href: "/admin" }));
  if ((st.data ?? []).length) out.push({ kind: "Home hero photo", title: "Site settings", href: "/admin/settings" });
  (cp.data ?? []).forEach((r: any) => out.push({ kind: "Photo carousel", title: "Edit carousel", href: `/admin/media/${r.lead_asset_id}` }));
  return out;
}
