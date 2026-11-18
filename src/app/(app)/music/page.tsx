import { requireUser } from "@/lib/auth";
import { resolveAssets, focal } from "@/lib/media";
import { EmptyState } from "@/components/ui";
import SongPlayer from "@/components/SongPlayer";

export const metadata = { title: "Our Songs" };

export default async function MusicPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("songs").select("id,title,artist,source_type,source_url,audio_asset_id,cover_asset_id,dedication,featured").order("featured", { ascending: false }).order("sort_order");
  const get = await resolveAssets(supabase, (data ?? []).flatMap((s: any) => [s.audio_asset_id, s.cover_asset_id]));
  return (
    <>
      <header className="page-head">
        <p className="overline">A soundtrack for two</p>
        <h1 className="h1">Our Songs</h1>
        <p className="caption" style={{ fontSize: 15 }}>For every feeling, a song that brings us back.</p>
      </header>
      {!data?.length ? <EmptyState icon="music" title="No songs yet" body="Songs will appear here once they are added." /> : (
        <div className="songs-collection">
        <div className="songs-collection__heading"><p className="overline">Made of memories</p><span className="caption">{data.length} {data.length === 1 ? "song" : "songs"} · Just for us</span></div>
        <ul className="songs-grid">
          {data.map((s: any, i: number) => <li key={s.id} className={s.featured ? "songs-grid__featured" : undefined}><SongPlayer collection track={i + 1} featured={s.featured} song={s} audioUrl={get(s.audio_asset_id)?.full} coverPhotos={get(s.cover_asset_id)?.photos} coverUrl={get(s.cover_asset_id)?.thumb} coverPosition={focal(get(s.cover_asset_id)?.asset)} /></li>)}
        </ul>
        </div>
      )}
    </>
  );
}
