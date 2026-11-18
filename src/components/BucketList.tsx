import Link from "next/link";
import { requireUser, getSettings } from "@/lib/auth";
import { notFound } from "next/navigation";
import { fmtDate } from "@/lib/dates";
import { addBucketItem, setBucketItemCompleted } from "@/app/actions/extras";
import ActionForm from "@/components/admin/ActionForm";

export default async function BucketList() {
  const { supabase, profile } = await requireUser();
  const settings = await getSettings();
  const admin = profile?.role === "admin";
  if (!settings?.feature_flags?.bucket_list && !admin) notFound();
  const { data: items, error } = await supabase.from("bucket_items").select("id,title,description,planned_at,completed_at")
    .eq("status", "published").order("sort_order").order("created_at");
  const completed = (items ?? []).filter((item) => item.completed_at).length;
  return <>
    <header className="page-head">
      <p className="overline">Together</p><h1 className="h1">Our bucket list</h1>
      <p>Little dreams and adventures to share.</p>
      {!error && <p className="caption">{completed} of {items?.length ?? 0} dreams completed</p>}
    </header>
    {!settings?.feature_flags?.bucket_list && <p className="caption">Hidden from her until you enable the shared bucket list in <Link href="/admin/settings">Site settings</Link>.</p>}
    {error ? <p className="err" role="alert">Couldn't load the bucket list. Please refresh to try again.</p> : items?.length ? <ul className="stack">
      {items.map((item) => <li key={item.id} className="card stack bucket-item" style={{ gap: 8 }}>
        <p className="overline">{item.completed_at ? "Completed together" : "Still to come"}</p>
        <h2 className="h2">{item.title}</h2>
        {item.description && <p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p>}
        {item.planned_at && <p className="caption">Planned for {fmtDate(item.planned_at, settings.timezone)}</p>}
        {item.completed_at && <p className="caption">Completed {fmtDate(item.completed_at, settings.timezone)}</p>}
        {admin && <ActionForm action={setBucketItemCompleted} submitLabel={item.completed_at ? "Mark as still to come" : "Mark as completed"} className="stack bucket-item-action">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="completed" value={item.completed_at ? "false" : "true"} />
        </ActionForm>}
      </li>)}
    </ul> : <div className="card stack"><h2 className="h2">Our next adventure starts here</h2><p className="caption">{admin ? "Add a dream below for you both to look forward to." : "Our shared dreams will appear here."}</p></div>}
    {admin && <section className="card stack bucket-list-editor" aria-label="Add a bucket list item">
      <h2 className="h2">Add a dream</h2>
      <ActionForm action={addBucketItem} submitLabel="Add to our list" className="stack bucket-list-form">
        <div className="field"><label htmlFor="bucket-title">What shall we do?</label><input id="bucket-title" name="title" required maxLength={200} /></div>
        <div className="field"><label htmlFor="bucket-description">The details</label><textarea id="bucket-description" name="description" rows={3} maxLength={2000} /></div>
        <div className="field"><label htmlFor="bucket-date">Planned date (optional)</label><input id="bucket-date" name="planned_at" type="date" /></div>
      </ActionForm>
    </section>}
  </>;
}
