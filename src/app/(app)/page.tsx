import PhotoCarousel from "@/components/PhotoCarousel";
import Link from "next/link";
import { requireUser, getSettings } from "@/lib/auth";
import { resolveAssets, focal } from "@/lib/media";
import { daysTogether, fmtDate, nextAnniversary } from "@/lib/dates";
import { fill, sharedDisplayName } from "@/lib/text";
import { Photo, RelationshipCounter, SongCard, LetterCard, Wordmark, Icon, Button } from "@/components/ui";

export const metadata = { title: "Home" };

export default async function Home() {
  const [{ supabase, profile }, s] = await Promise.all([requireUser(), getSettings()]);
  const tz = s.timezone;
  const name = sharedDisplayName(s);

  const [song, notes, album, chapter] = await Promise.all([
    supabase.from("songs").select("id,title,artist,dedication,source_type,cover_asset_id").order("featured", { ascending: false }).order("sort_order").limit(1).maybeSingle(),
    supabase.from("note_cards").select("id,title,teaser,kind,state,unlock_at,clue").eq("state", "unlocked").order("created_at", { ascending: false }).limit(1),
    supabase.from("albums").select("id,slug,title,cover_asset_id").order("featured", { ascending: false }).order("sort_order").limit(1).maybeSingle(),
    supabase.from("story_chapters").select("id,slug,title,teaser,event_date,cover_asset_id").order("featured", { ascending: false }).order("event_date", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ]);
  const get = await resolveAssets(supabase, [s.hero_asset_id, song.data?.cover_asset_id, album.data?.cover_asset_id, chapter.data?.cover_asset_id]);
  const hero = get(s.hero_asset_id);
  const days = daysTogether(s.relationship_start_date, tz);
  const ann = nextAnniversary(s.relationship_start_date, tz);
  const note = notes.data?.[0];
  const sections: { key: string; on: boolean }[] = s.home_sections ?? [];

  const blocks: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="hero-card" aria-label="Welcome">
        <div className="hero-card__photo">{hero ? <PhotoCarousel photos={hero.photos} label="Welcome photos" /> : <Photo fill tone={3} rounded="xl" label="" />}</div>
        <div className="hero-card__scrim">
          <h2 className="hero" style={{ fontSize: 34 }}>{fill(s.home_headline, name)}</h2>
          <p style={{ fontSize: 15 }}>{fill(s.home_subtitle, name)}</p>
        </div>
      </section>
    ),
    counter: days != null && (
      <RelationshipCounter key="counter" days={days} since={`Together since ${fmtDate(s.relationship_start_date, tz)}`}
        next={ann ? (ann.inDays === 0 ? `Happy anniversary!` : `Next anniversary in ${ann.inDays} day${ann.inDays === 1 ? "" : "s"}`) : undefined} />
    ),
    song: song.data && (
      <section key="song" aria-label="Our song" className="stack">
        <Link href="/music" className="link-card">
          <SongCard featured coverUrl={get(song.data.cover_asset_id)?.thumb} coverPosition={focal(get(song.data.cover_asset_id)?.asset)} title={song.data.title} artist={song.data.artist} source={sourceLabel(song.data.source_type)} dedication={song.data.dedication ? firstLine(song.data.dedication) : undefined} />
          <span className="song-link-label label">Open Our Songs <span aria-hidden="true">→</span></span>
        </Link>
      </section>
    ),
    note: note && (
      <section key="note" className="stack" aria-label="A note for you">
        <h2 className="h2">Something for you</h2>
        <Link href={`/notes/${note.id}`} className="link-card"><LetterCard kind={note.kind === "open_when" ? "open-when" : note.kind} state="unlocked" title={note.title} teaser={note.teaser} /></Link>
      </section>
    ),
    album: album.data && (
      <section key="album" className="stack" aria-label="Featured album">
        <h2 className="h2">From our photos</h2>
        {get(album.data.cover_asset_id) ? <PhotoCarousel photos={get(album.data.cover_asset_id)!.photos} label={album.data.title} /> : <div className="cover-wide photo-frame"><Photo fill tone={1} label="" /></div>}
        <Link href={`/gallery/${album.data.slug}`} className="link-card">
          <p className="card-title" style={{ marginTop: 10 }}>{album.data.title}</p>
        </Link>
      </section>
    ),
    chapter: chapter.data && (
      <section key="chapter" className="stack" aria-label="Featured chapter">
        <h2 className="h2">Our story</h2>
        {get(chapter.data.cover_asset_id) ? <PhotoCarousel photos={get(chapter.data.cover_asset_id)!.photos} label={chapter.data.title} /> : <div className="cover-wide photo-frame"><Photo fill tone={2} label="" /></div>}
        <Link href={`/story/${chapter.data.slug}`} className="link-card">
          {chapter.data.event_date && <p className="overline" style={{ marginTop: 10 }}>{fmtDate(chapter.data.event_date, tz)}</p>}
          <p className="card-title">{chapter.data.title}</p>
          <p className="caption">{chapter.data.teaser}</p>
        </Link>
      </section>
    ),
  };

  const empty = !hero && !song.data && !note && !album.data && !chapter.data && days == null;
  return (
    <>
      <header className="page-head" style={{ gap: 0 }}>
        <Wordmark />
        <p className="overline" style={{ marginTop: 14 }}>{greetingWord(tz)}</p>
        <h1 className="h2">Hi, {name} <Icon name="heart" size={20} filled style={{ color: "var(--accent)" }} /></h1>
      </header>
      {sections.filter((x) => x.on).map((x) => blocks[x.key] || null)}
      {empty && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="card-title">Nothing here yet</p>
          <p className="caption" style={{ margin: "6px 0 14px" }}>New memories will appear as they are published.</p>
          {profile?.role === "admin" && <Link className="os-btn os-btn--primary os-btn--md btnlink" href="/admin">Open the CMS</Link>}
        </div>
      )}
    </>
  );
}

function sourceLabel(t: string) {
  return ({ spotify: "Spotify", youtube: "YouTube", apple: "Apple Music", file: "Audio file", link: "Link" } as any)[t] ?? "Link";
}
function firstLine(s: string) {
  return s.split("\n")[0].slice(0, 60);
}
function greetingWord(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date()));
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
