import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { paragraphs, isUuid } from "@/lib/text";
import { SurpriseTile } from "@/components/ui";
import { surpriseCountdown, surpriseTypeLabel, type SurpriseState } from "@/lib/surprises";

export const metadata = { title: "A surprise" };

export default async function SurprisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireUser();
  const settings = await getSettings();
  const tz = settings?.timezone || "UTC";
  const { data: card } = await supabase
    .from("surprise_cards")
    .select("id,title,teaser,surprise_type,unlock_at,expires_at,state")
    .eq("id", id)
    .maybeSingle();
  if (!card) notFound();

  if (card.state !== "available") {
    return (
      <>
        <header className="page-head"><p className="overline">Not just yet</p><h1 className="h1">Your surprise is waiting</h1></header>
        <SurpriseTile state={card.state as SurpriseState} title={card.title} teaser={card.teaser} countdown={card.state === "countdown" ? surpriseCountdown(card.unlock_at) : undefined} />
        <p style={{ marginTop: 20 }}><Link href="/surprises" className="label">Back to surprises</Link></p>
      </>
    );
  }

  const { data: surprise } = await supabase
    .from("surprises")
    .select("id,title,teaser,surprise_type,message,linked_note_id,linked_album_id,unlock_at,expires_at")
    .eq("id", id)
    .maybeSingle();
  if (!surprise) notFound();
  const [{ data: linkedNote }, { data: linkedAlbum }] = await Promise.all([
    surprise.linked_note_id
      ? supabase.from("notes").select("id,title").eq("id", surprise.linked_note_id).maybeSingle()
      : Promise.resolve({ data: null }),
    surprise.linked_album_id
      ? supabase.from("albums").select("id,title,slug").eq("id", surprise.linked_album_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <header className="page-head"><p className="overline">{surpriseTypeLabel(surprise.surprise_type)}</p><h1 className="h1">{surprise.title}</h1></header>
      <article className="card surprise-reveal">
        <div className="surprise-reveal__gift" aria-hidden="true">♡</div>
        <div className="body-lg surprise-reveal__message">
          {paragraphs(surprise.message).map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <div className="seg surprise-reveal__actions">
          {linkedNote && <Link href={`/notes/${linkedNote.id}`} className="os-btn os-btn--primary os-btn--md"><span>Open the note</span></Link>}
          {linkedAlbum && <Link href={`/gallery/${linkedAlbum.slug}`} className="os-btn os-btn--quiet os-btn--md"><span>Open the album</span></Link>}
        </div>
        {surprise.expires_at && <p className="caption">Available until {fmtDateTime(surprise.expires_at, tz)}.</p>}
      </article>
      <p style={{ marginTop: 20 }}><Link href="/surprises" className="label">Back to surprises</Link></p>
    </>
  );
}
