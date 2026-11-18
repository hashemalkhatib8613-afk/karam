import type { CarouselPhoto } from "@/components/PhotoCarousel";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Asset = {
  id: string;
  storage_path: string;
  thumb_path: string | null;
  kind: "image" | "audio" | "video";
  title: string;
  alt_text: string;
  caption: string;
  focal_x: number;
  focal_y: number;
  width: number | null;
  height: number | null;
};

/** Short-lived signed URLs. The storage policy only signs objects the viewer may see. */
export async function signPaths(supabase: SupabaseClient, paths: (string | null | undefined)[], seconds = 3600) {
  const unique = [...new Set(paths.filter(Boolean) as string[])];
  const out: Record<string, string> = {};
  if (!unique.length) return out;
  const { data } = await supabase.storage.from("media").createSignedUrls(unique, seconds);
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  });
  return out;
}

const ASSET_COLS = "id, storage_path, thumb_path, kind, title, alt_text, caption, focal_x, focal_y, width, height";

export async function loadAssets(supabase: SupabaseClient, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return new Map<string, Asset>();
  const { data } = await supabase.from("media_assets").select(ASSET_COLS).in("id", unique);
  return new Map((data ?? []).map((a: any) => [a.id as string, a as Asset]));
}

export type Resolved = { asset: Asset; thumb: string; full: string; photos: CarouselPhoto[] } | null;

/** Loads assets by id and attaches signed URLs. Returns a lookup by asset id. */
export async function resolveAssets(supabase: SupabaseClient, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  const { data: links } = unique.length ? await supabase.from("media_carousel_photos")
    .select("lead_asset_id,media_id,sort_order").in("lead_asset_id", unique).order("sort_order") : { data: [] };
  const assets = await loadAssets(supabase, [...unique, ...(links ?? []).map((l) => l.media_id)]);
  const urls = await signPaths(
    supabase,
    [...assets.values()].flatMap((a) => [a.storage_path, a.thumb_path]),
  );
  const map = new Map<string, Exclude<Resolved, null>>();
  assets.forEach((a, id) => {
    const full = urls[a.storage_path];
    if (full) map.set(id, { asset: a, full, thumb: (a.thumb_path && urls[a.thumb_path]) || full, photos: [] });
  });
  map.forEach((resolved, id) => {
    resolved.photos = [id, ...(links ?? []).filter((l) => l.lead_asset_id === id).map((l) => l.media_id)]
      .flatMap((mid) => {
        const r = map.get(mid);
        return r && (r.asset.kind === "image" || r.asset.kind === "video") ? [{ id: mid,
          src: r.asset.kind === "video" ? r.thumb : r.full, full: r.full, kind: r.asset.kind, alt: r.asset.alt_text,
          width: r.asset.width, height: r.asset.height, focal: focal(r.asset), caption: r.asset.caption }] : [];
      });
  });
  return (id: string | null | undefined): Resolved => (id ? map.get(id) ?? null : null);
}

export const focal = (a?: Asset | null) => (a ? `${a.focal_x}% ${a.focal_y}%` : "50% 50%");
