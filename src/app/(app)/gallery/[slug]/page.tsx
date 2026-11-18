import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getSettings } from "@/lib/auth";
import { resolveAssets, focal } from "@/lib/media";
import { fmtDate } from "@/lib/dates";
import { EmptyState, Icon } from "@/components/ui";
import Lightbox from "@/components/Lightbox";

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const s = await getSettings();
  const { data: album } = await supabase.from("albums").select("*").eq("slug", slug).maybeSingle();
  if (!album) notFound();
  const { data: rows } = await supabase.from("album_media").select("media_id,caption,sort_order").eq("album_id", album.id).order("sort_order");
  const get = await resolveAssets(supabase, (rows ?? []).map((r: any) => r.media_id));
  const items = (rows ?? []).flatMap((r: any) => {
    const x = get(r.media_id);
    return x && x.asset.kind !== "audio" ? [{ id: x.asset.id, thumb: x.thumb, full: x.full, kind: x.asset.kind, alt: x.asset.alt_text, caption: r.caption || x.asset.caption, focal: focal(x.asset), photos: x.photos }] : [];
  });
  return (
    <>
      <div className="page-head" style={{ paddingTop: 12 }}>
        <Link href="/gallery" className="label" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}><Icon name="chevron-left" size={20} />All albums</Link>
        <h1 className="h1">{album.title}</h1>
        {(album.date_start || album.date_end) && <p className="overline">{fmtDate(album.date_start, s.timezone)}{album.date_end && album.date_end !== album.date_start ? ` – ${fmtDate(album.date_end, s.timezone)}` : ""}</p>}
        {album.description && <p style={{ marginTop: 6 }}>{album.description}</p>}
        <p className="caption">{items.length} {items.length === 1 ? "item" : "items"}</p>
      </div>
      {items.length ? <Lightbox items={items} label={`Photos and videos in ${album.title}`} albumLayout={album.layout_type} mediaAspect={album.media_aspect} /> : <EmptyState icon="image" title="No photos or videos in this album yet" body="Check back soon." />}
    </>
  );
}
