import PhotoCarousel from "@/components/PhotoCarousel";
import Link from "next/link";
import { requireUser, getSettings } from "@/lib/auth";
import { resolveAssets } from "@/lib/media";
import { fmtDate } from "@/lib/dates";
import { EmptyState, Photo } from "@/components/ui";

export const metadata = { title: "Photos" };

export default async function GalleryPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const { supabase } = await requireUser();
  const s = await getSettings();
  const { data } = await supabase.from("albums").select("id,slug,title,description,category,cover_asset_id,date_start,date_end,featured").order("featured", { ascending: false }).order("sort_order");
  const cats = [...new Set((data ?? []).map((a: any) => a.category).filter(Boolean))] as string[];
  const shown = (data ?? []).filter((a: any) => !c || a.category === c);
  const get = await resolveAssets(supabase, shown.map((a: any) => a.cover_asset_id));
  return (
    <>
      <header className="page-head">
        <p className="overline">Gallery</p>
        <h1 className="h1">Little moments, big love.</h1>
        <p className="caption" style={{ fontSize: 15 }}>Every picture has a story.</p>
        {cats.length > 0 && (
          <nav aria-label="Categories" className="row-scroll" style={{ marginTop: 8 }}>
            <Link href="/gallery" className={`os-chip ${!c ? "is-selected" : ""}`}>All</Link>
            {cats.map((k) => <Link key={k} href={`/gallery?c=${encodeURIComponent(k)}`} className={`os-chip ${c === k ? "is-selected" : ""}`}>{k}</Link>)}
          </nav>
        )}
      </header>
      {!shown.length ? (
        <EmptyState icon="image" title="No albums yet" body="Photos will appear here as albums are published." />
      ) : (
        <ul className="grid2">
          {shown.map((a: any, i: number) => {
            const cover = get(a.cover_asset_id);
            return (
              <li key={a.id}>
                {cover?.photos.length ? <PhotoCarousel photos={cover.photos} label={a.title} className="album-cover" /> : <div className="cover-wide photo-frame album-cover"><Photo fill tone={((i % 4) + 1) as any} label="" /></div>}
                <Link href={`/gallery/${a.slug}`} className="link-card">
                  <p className="label" style={{ marginTop: 6 }}>{a.title}</p>
                  {(a.date_start) && <p className="caption">{fmtDate(a.date_start, s.timezone, { month: "short", year: "numeric" })}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
