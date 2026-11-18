import Link from "next/link";
import { requireAdmin, getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Overview" };

const FREE_BYTES = 1024 ** 3; // Supabase free tier: 1 GB of file storage

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const settings = await getSettings();
  const tz = settings?.timezone || "UTC";

  const count = async (table: string, f?: (q: any) => any) => {
    let q: any = supabase.from(table).select("id", { count: "exact", head: true });
    if (f) q = f(q);
    const { count: n } = await q;
    return n ?? 0;
  };
  const [media, albums, chapters, notes, songs, drafts, scheduled, sizes, audit] = await Promise.all([
    count("media_assets", (q) => q.is("archived_at", null)),
    count("albums"),
    count("story_chapters"),
    count("notes"),
    count("songs"),
    Promise.all(["albums", "story_chapters", "notes", "songs"].map((t) => count(t, (q) => q.eq("status", "draft")))).then((a) => a.reduce((x, y) => x + y, 0)),
    Promise.all(["albums", "story_chapters", "notes", "songs"].map((t) => count(t, (q) => q.eq("status", "scheduled")))).then((a) => a.reduce((x, y) => x + y, 0)),
    supabase.from("media_assets").select("file_size").limit(5000),
    supabase.from("audit_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  const used = (sizes.data ?? []).reduce((s: number, r: any) => s + Number(r.file_size || 0), 0);
  const pct = Math.min(100, Math.round((used / FREE_BYTES) * 100));
  const mb = (used / 1024 ** 2).toFixed(used > 100 * 1024 ** 2 ? 0 : 1);

  const stats: [string, number, string][] = [
    ["Photos, audio & videos", media, "/admin/media"],
    ["Albums", albums, "/admin/albums"],
    ["Story chapters", chapters, "/admin/stories"],
    ["Notes", notes, "/admin/notes"],
    ["Songs", songs, "/admin/songs"],
    ["Drafts", drafts, "/admin"],
    ["Scheduled", scheduled, "/admin"],
  ];

  return (
    <>
      <header className="adm__head">
        <div className="page-head" style={{ padding: 0 }}>
          <p className="overline">Overview</p>
          <h1 className="h1">Welcome back</h1>
        </div>
      </header>

      <section className="stat-grid" aria-label="Content counts">
        {stats.map(([label, n, href]) => (
          <Link key={label} href={href} className="stat" style={{ textDecoration: "none", color: "inherit" }}>
            <b>{n}</b>
            <span className="caption">{label}</span>
          </Link>
        ))}
      </section>

      <section className="card stack" aria-label="Storage">
        <h2 className="card-title">Storage</h2>
        <p className="caption" style={{ fontSize: 15 }}>
          {mb} MB used of the free 1 GB. Photos are resized to 2400 px before they upload to keep this low.
        </p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Storage used" style={{ height: 10, background: "var(--surface-tint)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct > 85 ? "var(--danger)" : "var(--accent)" }} />
        </div>
      </section>

      <section className="stack" aria-label="Recent activity">
        <h2 className="card-title">Recent activity</h2>
        {(audit.data ?? []).length === 0 ? (
          <EmptyState icon="history" title="Nothing yet" body="Your changes will be listed here." />
        ) : (
          <table className="adm-table">
            <thead><tr><th>What happened</th><th>When</th></tr></thead>
            <tbody>
              {(audit.data ?? []).map((a: any) => (
                <tr key={a.id}><td data-label="What happened">{a.action}</td><td data-label="When">{fmtDateTime(a.created_at, tz)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <Link href="/admin/audit" className="label">See the full activity log</Link>
      </section>
    </>
  );
}
