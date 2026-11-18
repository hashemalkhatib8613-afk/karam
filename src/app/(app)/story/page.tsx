import { requireUser, getSettings } from "@/lib/auth";
import { resolveAssets } from "@/lib/media";
import { fmtDate } from "@/lib/dates";
import Link from "next/link";
import { EmptyState, TimelineMilestone } from "@/components/ui";

export const metadata = { title: "Our Story" };

export default async function StoryPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const s = await getSettings();
  const newest = sp.order === "new";
  const { data } = await supabase
    .from("story_chapters").select("id,slug,title,teaser,event_date,cover_asset_id")
    .order("event_date", { ascending: !newest, nullsFirst: false }).order("sort_order");
  const get = await resolveAssets(supabase, (data ?? []).map((c: any) => c.cover_asset_id));
  return (
    <>
      <header className="page-head">
        <p className="overline">Our Story</p>
        <h1 className="h1">The chapters of us</h1>
        <nav aria-label="Order" className="row-scroll" style={{ marginTop: 8 }}>
          <Link href="/story" className={`os-chip ${!newest ? "is-selected" : ""}`} aria-current={!newest ? "true" : undefined}>Oldest first</Link>
          <Link href="/story?order=new" className={`os-chip ${newest ? "is-selected" : ""}`} aria-current={newest ? "true" : undefined}>Newest first</Link>
        </nav>
      </header>
      {!data?.length ? (
        <EmptyState icon="book" title="No chapters yet" body="The story will appear here as each chapter is published." />
      ) : (
        <ol className="os-tl-list tl-wrap">
          {data.map((c: any, i: number) => (
            <TimelineMilestone key={c.id} href={`/story/${c.slug}`} cover={get(c.cover_asset_id)?.thumb} photos={get(c.cover_asset_id)?.photos} first={i === 0} last={i === data.length - 1}
              date={c.event_date ? fmtDate(c.event_date, s.timezone) : "Chapter"} title={c.title} teaser={c.teaser} tone={((i % 4) + 1) as any} />
          ))}
        </ol>
      )}
    </>
  );
}
