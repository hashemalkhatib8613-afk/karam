import { requireAdmin, getSettings } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Activity log" };

export default async function AuditPage() {
  const { supabase } = await requireAdmin();
  const tz = (await getSettings())?.timezone || "UTC";
  const { data } = await supabase.from("audit_logs").select("id,action,entity_type,entity_id,metadata,created_at").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <header className="page-head" style={{ padding: 0 }}>
        <p className="overline">Activity</p>
        <h1 className="h1">What changed, and when</h1>
      </header>
      {(data ?? []).length === 0 ? (
        <EmptyState icon="history" title="Nothing yet" body="Publishing, uploads and settings changes are recorded here." />
      ) : (
        <table className="adm-table">
          <thead><tr><th scope="col">When</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {(data ?? []).map((a: any) => (
              <tr key={a.id}>
                <td data-label="When">{fmtDateTime(a.created_at, tz)}</td>
                <td data-label="What">{a.action}</td>
                <td data-label="Details" className="caption">{a.metadata?.title || a.metadata?.path || a.entity_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
