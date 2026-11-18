import { getViewer, getSettings } from "@/lib/auth";
import { isUuid, slugify } from "@/lib/text";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await getViewer();
  if (!user) return new Response("Please sign in first.", { status: 401 });
  const settings = await getSettings();
  if (!settings?.feature_flags?.downloads) return new Response("Photo downloads are turned off.", { status: 403 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Photo not found.", { status: 404 });
  // Use the visitor's client: database and storage policies both enforce visibility.
  const { data: asset } = await supabase.from("media_assets").select("storage_path,title,kind,mime_type").eq("id", id).maybeSingle();
  if (!asset || asset.kind !== "image") return new Response("Photo not found.", { status: 404 });
  const { data, error } = await supabase.storage.from("media").download(asset.storage_path);
  if (error || !data) return new Response("Couldn't download this photo. Please try again.", { status: 404 });
  const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif", "image/heic": "heic" } as Record<string, string>)[asset.mime_type] || "jpg";
  return new Response(data, { headers: {
    "Content-Type": asset.mime_type || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${slugify(asset.title || "our-photo") || "our-photo"}.${extension}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
