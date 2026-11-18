import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getSettings } from "@/lib/auth";
import { resolveAssets, focal } from "@/lib/media";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { fill, isUuid, paragraphs, sharedDisplayName } from "@/lib/text";
import { Icon, Letter } from "@/components/ui";
import SongPlayer from "@/components/SongPlayer";
import ClueForm from "./ClueForm";
import NoteReplies from "@/components/NoteReplies";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireUser();
  const s = await getSettings();
  const back = (
    <div className="page-head" style={{ paddingTop: 12 }}>
      <Link href="/notes" className="label" style={{ display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44 }}><Icon name="chevron-left" size={20} />All letters</Link>
    </div>
  );

  // The row below is returned by the database only when the note is live, due, and (if needed) unlocked.
  const { data: note } = await supabase.from("notes").select("id,title,body,kind,song_id,audio_asset_id,created_at").eq("id", id).maybeSingle();
  if (note) {
    const { data: song } = note.song_id ? await supabase.from("songs").select("id,title,artist,source_type,source_url,audio_asset_id,cover_asset_id,dedication").eq("id", note.song_id).maybeSingle() : { data: null };
    const get = await resolveAssets(supabase, [note.audio_asset_id, song?.audio_asset_id, song?.cover_asset_id]);
    const voice = get(note.audio_asset_id);
    return (
      <>
        {back}
        <Letter date={fmtDate(note.created_at, s.timezone)} to={note.title} signature={s.welcome_signature}>
          {paragraphs(fill(note.body, sharedDisplayName(s))).map((p, i) => <p key={i}>{p}</p>)}
        </Letter>
        {voice && <audio controls preload="none" src={voice.full} style={{ width: "100%" }} aria-label="Voice recording">Your browser can't play this audio.</audio>}
        {song && <SongPlayer song={song} coverUrl={get(song.cover_asset_id)?.thumb} coverPosition={focal(get(song.cover_asset_id)?.asset)} audioUrl={get(song.audio_asset_id)?.full} />}
        {s.feature_flags?.replies && <NoteReplies noteId={id} timezone={s.timezone} />}
      </>
    );
  }

  // Not readable: show the safe teaser card (or a not-found if it was never visible).
  const { data: card } = await supabase.from("note_cards").select("id,title,teaser,state,unlock_at,clue").eq("id", id).maybeSingle();
  if (!card) notFound();
  return (
    <>
      {back}
      <div className="card stack" style={{ textAlign: "center", alignItems: "center" }}>
        <Icon name="lock" size={32} />
        <h1 className="h2">{card.title}</h1>
        {card.teaser && <p>{card.teaser}</p>}
        {card.state === "scheduled" && <p className="label">This arrives {fmtDateTime(card.unlock_at, s.timezone)}.</p>}
        {card.state === "pin" && <ClueForm id={card.id} clue={card.clue} />}
      </div>
    </>
  );
}
