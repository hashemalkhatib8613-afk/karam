import type { SupabaseClient } from "@supabase/supabase-js";
import { signPaths } from "@/lib/media";

export type PickerAsset = { id: string; title: string; kind: string; thumb: string | null };

/** Library items for the media picker, with signed thumbnails. */
export async function loadPickerAssets(supabase: SupabaseClient, limit = 400): Promise<PickerAsset[]> {
  const { data } = await supabase
    .from("media_assets").select("id,title,kind,thumb_path,storage_path,created_at")
    .is("archived_at", null).order("created_at", { ascending: false }).limit(limit);
  const urls = await signPaths(supabase, (data ?? []).map((a: any) => a.kind === "image" ? a.thumb_path || a.storage_path : a.kind === "video" ? a.thumb_path : null));
  return (data ?? []).map((a: any) => ({
    id: a.id, title: a.title || a.storage_path.split("/").pop(), kind: a.kind,
    thumb: a.kind === "image" ? urls[a.thumb_path || a.storage_path] ?? null : a.kind === "video" ? urls[a.thumb_path] ?? null : null,
  }));
}
