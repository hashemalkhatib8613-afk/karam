import Link from "next/link";
import { requireUser, getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { EmptyState, LetterCard } from "@/components/ui";

export const metadata = { title: "Letters to You" };

const KIND: Record<string, string> = { open_when: "open-when" };

export default async function NotesPage() {
  const { supabase } = await requireUser();
  const s = await getSettings();
  // note_cards exposes teasers only; bodies are fetched on the detail page and only if the database allows it.
  const { data } = await supabase.from("note_cards").select("id,title,teaser,kind,state,unlock_at").order("created_at", { ascending: false });
  return (
    <>
      <header className="page-head">
        <p className="overline">Private</p>
        <h1 className="h1">Letters to You</h1>
      </header>
      {!data?.length ? (
        <EmptyState icon="envelope" title="No letters yet" body="Notes will arrive here when they are ready." />
      ) : (
        <ul className="stack">
          {data.map((n: any) => (
            <li key={n.id}>
              <Link href={`/notes/${n.id}`} className="link-card">
                <LetterCard kind={(KIND[n.kind] ?? n.kind) as any} state={n.state} title={n.title} teaser={n.state === "unlocked" ? n.teaser : n.teaser || "Not ready yet."}
                  when={n.state === "scheduled" && n.unlock_at ? fmtDateTime(n.unlock_at, s.timezone) : undefined} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
