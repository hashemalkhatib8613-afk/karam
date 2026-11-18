import PhotoCarousel from "@/components/PhotoCarousel";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getSettings } from "@/lib/auth";
import { resolveAssets, focal } from "@/lib/media";
import { fmtDate } from "@/lib/dates";
import { paragraphs } from "@/lib/text";
import { Photo, Icon } from "@/components/ui";
import SongPlayer from "@/components/SongPlayer";
import Lightbox from "@/components/Lightbox";

export default async function ChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase } = await requireUser();
  const s = await getSettings();
  const { data: ch } = await supabase.from("story_chapters").select("*").eq("slug", slug).maybeSingle();
  if (!ch) notFound();

  const [{ data: media }, { data: song }, { data: all }] = await Promise.all([
    supabase.from("chapter_media").select("media_id,sort_order").eq("chapter_id", ch.id).order("sort_order"),
    ch.song_id ? supabase.from("songs").select("id,title,artist,source_type,source_url,audio_asset_id,cover_asset_id,dedication").eq("id", ch.song_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("story_chapters").select("slug,title,event_date,sort_order").order("event_date", { ascending: true, nullsFirst: false }).order("sort_order"),
  ]);
  const get = await resolveAssets(supabase, [ch.cover_asset_id, song?.audio_asset_id, song?.cover_asset_id, ...(media ?? []).map((m: any) => m.media_id)]);
  const cover = get(ch.cover_asset_id);
  const idx = (all ?? []).findIndex((c: any) => c.slug === slug);
  const prev = idx > 0 ? all![idx - 1] : null;
  const next = idx >= 0 && idx < (all?.length ?? 0) - 1 ? all![idx + 1] : null;
  const gallery = (media ?? []).map((m: any) => get(m.media_id)).filter((r) => r && r.asset.kind !== "audio").map((r: any) => ({ id: r.asset.id, thumb: r.thumb, full: r.full, kind: r.asset.kind, alt: r.asset.alt_text, caption: r.asset.caption, focal: focal(r.asset), photos: r.photos }));

  return (
    <>
      <div className="page-head" style={{ paddingTop: 12 }}>
        <Link href="/story" className="label" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}><Icon name="chevron-left" size={20} />All chapters</Link>
      </div>
      {cover ? <PhotoCarousel photos={cover.photos} label={`${ch.title} photos`} /> : <div className="cover-wide photo-frame"><Photo fill tone={1} rounded="xl" label="" /></div>}
      <header className="stack" style={{ gap: 6 }}>
        {ch.event_date && <p className="overline">{fmtDate(ch.event_date, s.timezone)}</p>}
        <h1 className="h1">{ch.title}</h1>
      </header>
      <div className="prose">{paragraphs(ch.body).map((p, i) => <p key={i}>{p}</p>)}</div>
      {gallery.length > 0 && <Lightbox items={gallery} targetType="media" label="Photos and videos from this chapter" />}
      {song && <SongPlayer song={song} coverUrl={get(song.cover_asset_id)?.thumb} coverPosition={focal(get(song.cover_asset_id)?.asset)} audioUrl={song.audio_asset_id ? get(song.audio_asset_id)?.full : undefined} />}
      <nav aria-label="Chapters" className="grid2 chapter-nav" style={{ marginTop: 8 }}>
        {prev ? <Link className="os-btn os-btn--quiet os-btn--md btnlink" href={`/story/${prev.slug}`}><Icon name="chevron-left" size={18} />{prev.title}</Link> : <span />}
        {next ? <Link className="os-btn os-btn--primary os-btn--md btnlink" href={`/story/${next.slug}`}>{next.title}<Icon name="chevron-right" size={18} /></Link> : <span />}
      </nav>
    </>
  );
}
