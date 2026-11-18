import { requireUser } from "@/lib/auth";
import { EmptyState, SurpriseTile } from "@/components/ui";
import { surpriseCountdown, type SurpriseState } from "@/lib/surprises";

export const metadata = { title: "Surprises" };

type Card = {
  id: string;
  title: string;
  teaser: string;
  surprise_type: string;
  unlock_at: string | null;
  expires_at: string | null;
  state: SurpriseState;
};

export default async function SurprisesPage() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("surprise_cards")
    .select("id,title,teaser,surprise_type,unlock_at,expires_at,state")
    .order("unlock_at", { ascending: true, nullsFirst: true });
  const cards = (data ?? []) as Card[];

  return (
    <>
      <header className="page-head"><p className="overline">Made for you</p><h1 className="h1">Surprises</h1><p className="caption">Little things waiting for just the right moment.</p></header>
      {error ? (
        <p className="err" role="alert">Surprises could not be loaded right now.</p>
      ) : cards.length === 0 ? (
        <EmptyState icon="gift" title="Nothing here yet" body="The best surprises are still being dreamed up." action={null} />
      ) : (
        <div className="stack">
          {cards.map((card) => (
            <SurpriseTile
              key={card.id}
              state={card.state}
              title={card.title}
              teaser={card.teaser}
              countdown={card.state === "countdown" ? surpriseCountdown(card.unlock_at) : undefined}
              href={card.state === "available" ? `/surprises/${card.id}` : undefined}
            />
          ))}
        </div>
      )}
    </>
  );
}
