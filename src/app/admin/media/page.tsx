import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import Uploader from "@/components/admin/Uploader";
import { EmptyState, Icon } from "@/components/ui";

export const metadata = { title: "Media Library" };
const PAGE = 48;

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ page?: string; kind?: string; q?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const kind = sp.kind === "audio" || sp.kind === "image" || sp.kind === "video" ? sp.kind : "";
  const q = (sp.q ?? "").trim().slice(0, 60);

  let query = supabase.from("media_assets").select("id,title,kind,thumb_path,storage_path,file_size,created_at", { count: "exact" }).is("archived_at", null);
  if (kind) query = query.eq("kind", kind);
  if (q) query = query.ilike("title", `%${q.replace(/[%_,()]/g, " ")}%`);
  const { data, count } = await query.order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  const urls = await signPaths(supabase, (data ?? []).map((a: any) => a.kind === "image" ? a.thumb_path || a.storage_path : a.kind === "video" ? a.thumb_path : null));
  const total = count ?? 0;
  const href = (p: number) => `/admin/media?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <header className="page-head" style={{ padding: 0 }}>
        <p className="overline">Library</p>
        <h1 className="h1">Photos, audio &amp; videos</h1>
      </header>

      <Uploader />

      <form className="seg" role="search" action="/admin/media">
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="mq">Search by name</label>
          <input id="mq" type="text" name="q" defaultValue={q} />
        </div>
        <div className="field">
          <label htmlFor="mk">Show</label>
          <select id="mk" name="kind" defaultValue={kind}>
            <option value="">Everything</option>
            <option value="image">Photos</option>
            <option value="audio">Audio</option>
            <option value="video">Videos</option>
          </select>
        </div>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button type="submit" className="os-btn os-btn--quiet os-btn--md"><Icon name="search" size={18} /><span>Filter</span></button>
        </div>
      </form>

      {(data ?? []).length === 0 ? (
        <EmptyState icon="image" title="Nothing here yet" body="Add photos, audio, or videos above. They stay private and are only shown to the two of you." />
      ) : (
        <ul className="media-grid">
          {(data ?? []).map((a: any) => {
            const thumb = urls[a.thumb_path || a.storage_path];
            return (
              <li key={a.id}>
                <Link href={`/admin/media/${a.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <span className="pick__thumb" style={{ width: "100%", height: "auto", aspectRatio: "1 / 1", display: "block" }}>
                    {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span style={{ display: "grid", placeItems: "center", height: "100%" }}><Icon name={a.kind === "audio" ? "music" : "image"} size={36} /></span>}
                  </span>
                  <span className="label" style={{ display: "block", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title || a.storage_path.split("/").pop()}</span>
                  <span className="caption">{a.kind === "audio" ? "Audio · " : a.kind === "video" ? "Video · " : ""}{(a.file_size / 1024 / 1024).toFixed(1)} MB</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE && (
        <nav className="seg" aria-label="Pages">
          {page > 0 && <Link className="os-btn os-btn--quiet os-btn--sm" href={href(page - 1)}><Icon name="chevron-left" size={16} /><span>Newer</span></Link>}
          <span className="caption" style={{ alignSelf: "center" }}>{page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} of {total}</span>
          {(page + 1) * PAGE < total && <Link className="os-btn os-btn--quiet os-btn--sm" href={href(page + 1)}><span>Older</span><Icon name="chevron-right" size={16} /></Link>}
        </nav>
      )}
    </>
  );
}
