import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, getSettings } from "@/lib/auth";
import { ENTITIES } from "@/lib/entities";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { EmptyState, StatusBadge } from "@/components/ui";

export default async function EntityList({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  const ent = ENTITIES[entity];
  if (!ent) notFound();
  const { supabase } = await requireAdmin();
  const tz = (await getSettings())?.timezone || "UTC";
  const { data } = await supabase.from(ent.table).select("*").order(ent.orderBy.column, { ascending: ent.orderBy.ascending }).limit(500);
  const rows = (data ?? []) as any[];
  const kindLabel = (col: string, v: any) => {
    const f = ent.fields.find((x) => x.name === col);
    return f?.options?.find(([val]) => val === v)?.[1] ?? v ?? "";
  };
  const head = (c: string) => ent.fields.find((f) => f.name === c)?.label ?? (c === "status" ? "Status" : c === "sort_order" ? "Order" : c);

  return (
    <>
      <header className="adm__head">
        <div className="page-head" style={{ padding: 0 }}>
          <p className="overline">Content</p>
          <h1 className="h1">{ent.label}</h1>
        </div>
        <Link href={`/admin/${ent.key}/new`} className="os-btn os-btn--primary os-btn--md"><span>New {ent.singular}</span></Link>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon="envelope" title={`No ${ent.label.toLowerCase()} yet`} body={`Create your first ${ent.singular}. It stays a draft until you publish it.`} action={<Link href={`/admin/${ent.key}/new`} className="os-btn os-btn--primary os-btn--md"><span>New {ent.singular}</span></Link>} />
      ) : (
        <table className="adm-table">
          <thead>
            <tr>{ent.listColumns.map((c) => <th key={c} scope="col">{head(c)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {ent.listColumns.map((c, i) => (
                  <td key={c} data-label={head(c)}>
                    {c === "status" ? (
                      <StatusBadge status={r.status} detail={r.status === "scheduled" && r.scheduled_at ? fmtDateTime(r.scheduled_at, tz) : undefined} />
                    ) : i === 0 ? (
                      <Link href={`/admin/${ent.key}/${r.id}`}>{r[c] || "Untitled"}</Link>
                    ) : c.endsWith("_date") || c === "created_at" ? (
                      fmtDate(r[c], tz)
                    ) : (
                      kindLabel(c, r[c])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
