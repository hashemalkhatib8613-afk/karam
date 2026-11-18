import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin, getSettings } from "@/lib/auth";
import { ENTITIES, STATUS_OPTIONS, type Field } from "@/lib/entities";
import { isoToLocal } from "@/lib/dates";
import { isUuid } from "@/lib/text";
import { signPaths } from "@/lib/media";
import { loadPickerAssets } from "@/lib/picker";
import { saveEntity, deleteEntity, attachMedia, detachMedia, moveMedia, saveNoteClue } from "@/app/actions/admin";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import MediaPicker from "@/components/admin/MediaPicker";
import { Icon } from "@/components/ui";
import NoteReplies from "@/components/NoteReplies";

export const metadata = { title: "Edit" };

type SongOpt = { id: string; title: string };
type RelationOpt = { id: string; title: string };

function FieldInput({ f, value, tz, images, audio, songs, notes, albums }: { f: Field; value: any; tz: string; images: any[]; audio: any[]; songs: SongOpt[]; notes: RelationOpt[]; albums: RelationOpt[] }) {
  const id = "f_" + f.name;
  const help = f.help ? <span className="help" id={id + "_h"}>{f.help}</span> : null;
  const aria = f.help ? { "aria-describedby": id + "_h" } : {};
  switch (f.type) {
    case "checkbox":
      return (
        <div className="field">
          <label className="check"><input type="checkbox" name={f.name} defaultChecked={!!value} />{f.label}</label>
          {help}
        </div>
      );
    case "media":
      return <MediaPicker name={f.name} label={f.label} help={f.help} items={f.mediaKind === "audio" ? audio : images} initial={value ? [value] : []} />;
    case "song":
    case "note":
    case "album":
      const choices = f.type === "song" ? songs : f.type === "note" ? notes : albums;
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <select id={id} name={f.name} defaultValue={value ?? ""} {...aria}>
            <option value="">None</option>
            {choices.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          {help}
        </div>
      );
    case "select":
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <select id={id} name={f.name} defaultValue={value ?? f.options![0][0]} {...aria}>
            {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {help}
        </div>
      );
    case "textarea":
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <textarea id={id} name={f.name} rows={f.rows ?? 4} defaultValue={value ?? ""} {...aria} />
          {help}
        </div>
      );
    case "datetime":
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <input id={id} type="datetime-local" name={f.name} defaultValue={isoToLocal(value, tz)} {...aria} />
          {help}
        </div>
      );
    case "date":
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <input id={id} type="date" name={f.name} defaultValue={value ?? ""} {...aria} />
          {help}
        </div>
      );
    case "number":
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <input id={id} type="number" name={f.name} defaultValue={value ?? 0} {...aria} />
          {help}
        </div>
      );
    case "url":
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}</label>
          <input id={id} type="url" name={f.name} defaultValue={value ?? ""} placeholder="https://" {...aria} />
          {help}
        </div>
      );
    default:
      return (
        <div className="field">
          <label htmlFor={id}>{f.label}{f.required ? " *" : ""}</label>
          <input id={id} type="text" name={f.name} defaultValue={value ?? ""} required={f.required} maxLength={f.type === "slug" ? 60 : 300} {...aria} />
          {help}
        </div>
      );
  }
}

export default async function EntityEdit({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { entity, id } = await params;
  const sp = await searchParams;
  const ent = ENTITIES[entity];
  if (!ent) notFound();
  const isNew = id === "new";
  if (!isNew && !isUuid(id)) notFound();
  const { supabase } = await requireAdmin();
  const settings = await getSettings();
  const tz = settings?.timezone || "UTC";

  let row: any = {};
  if (!isNew) {
    const { data } = await supabase.from(ent.table).select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    row = data;
  }

  const needsMedia = ent.fields.some((f) => f.type === "media") || !!ent.join;
  const needsSongs = ent.fields.some((f) => f.type === "song");
  const needsNotes = ent.fields.some((f) => f.type === "note");
  const needsAlbums = ent.fields.some((f) => f.type === "album");
  const [all, songRows, noteRows, albumRows] = await Promise.all([
    needsMedia ? loadPickerAssets(supabase) : Promise.resolve([]),
    needsSongs ? supabase.from("songs").select("id,title").order("title").then((r) => (r.data ?? []) as SongOpt[]) : Promise.resolve([] as SongOpt[]),
    needsNotes ? supabase.from("notes").select("id,title").order("title").then((r) => (r.data ?? []) as RelationOpt[]) : Promise.resolve([] as RelationOpt[]),
    needsAlbums ? supabase.from("albums").select("id,title").order("title").then((r) => (r.data ?? []) as RelationOpt[]) : Promise.resolve([] as RelationOpt[]),
  ]);
  const images = all.filter((a) => a.kind === "image" || a.kind === "video");
  const audio = all.filter((a) => a.kind === "audio");

  // Attached media list (album photos / chapter photos) with thumbnails, in order.
  let attached: { media_id: string; title: string; thumb: string | null }[] = [];
  if (ent.join && !isNew) {
    const { data: links } = await supabase.from(ent.join.table).select("media_id,sort_order").eq(ent.join.fk, id).order("sort_order");
    const ids = (links ?? []).map((l: any) => l.media_id as string);
    if (ids.length) {
      const { data: assets } = await supabase.from("media_assets").select("id,title,kind,thumb_path,storage_path").in("id", ids);
      const urls = await signPaths(supabase, (assets ?? []).map((a: any) => a.kind === "video" ? a.thumb_path : a.thumb_path || a.storage_path));
      const byId = new Map((assets ?? []).map((a: any) => [a.id, a]));
      attached = ids.flatMap((mid) => {
        const a: any = byId.get(mid);
        return a ? [{ media_id: mid, title: a.title || a.storage_path.split("/").pop(), thumb: urls[a.thumb_path || a.storage_path] ?? null }] : [];
      });
    }
  }
  const attachedIds = new Set(attached.map((a) => a.media_id));

  // Note clue (admin can read the question, never the answer).
  let clue: string | null = null;
  if (ent.key === "notes" && !isNew) {
    const { data } = await supabase.from("note_secrets").select("clue").eq("note_id", id).maybeSingle();
    clue = data?.clue ?? null;
  }

  const status = row.status ?? "draft";
  const hidden = (
    <>
      <input type="hidden" name="_entity" value={ent.key} />
      <input type="hidden" name="_id" value={isNew ? "new" : id} />
    </>
  );

  return (
    <>
      <header className="adm__head">
        <div className="page-head" style={{ padding: 0 }}>
          <p className="overline"><Link href={`/admin/${ent.key}`}>{ent.label}</Link></p>
          <h1 className="h1">{isNew ? `New ${ent.singular}` : row.title || "Untitled"}</h1>
        </div>
        {!isNew && status === "published" && ent.publicPath && <Link href={ent.publicPath(row)} className="os-btn os-btn--quiet os-btn--sm"><Icon name="external" size={16} /><span>View on site</span></Link>}
      </header>

      {sp.saved && <p className="ok" role="status">Saved.</p>}

      <ActionForm action={saveEntity} submitLabel={isNew ? "Create" : "Save changes"}>
        {hidden}
        {ent.fields.map((f) => (
          <FieldInput key={f.name} f={f} value={row[f.name]} tz={tz} images={images} audio={audio} songs={songRows} notes={noteRows} albums={albumRows} />
        ))}

        <fieldset className="card stack" style={{ margin: 0 }}>
          <legend className="lbl" style={{ padding: "0 6px" }}>Visibility</legend>
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <span className="help">Drafts and archived items are never shown to her. Scheduled items appear by themselves at the time you choose.</span>
          </div>
          <div className="field">
            <label htmlFor="scheduled_at">Go live at (only for Scheduled)</label>
            <input id="scheduled_at" type="datetime-local" name="scheduled_at" defaultValue={isoToLocal(row.scheduled_at, tz)} />
            <span className="help">Time zone: {tz}</span>
          </div>
        </fieldset>
      </ActionForm>

      {ent.key === "notes" && !isNew && settings?.feature_flags?.replies && <NoteReplies noteId={id} timezone={tz} />}

      {ent.join && !isNew && (
        <section className="card stack" aria-label={ent.join.label}>
          <h2 className="card-title">{ent.join.label}</h2>
          {attached.length === 0 ? (
            <p className="caption" style={{ fontSize: 15 }}>No photos or videos yet.</p>
          ) : (
            <ol className="attached">
              {attached.map((a, i) => (
                <li key={a.media_id}>
                  <span className="pick__thumb">{a.thumb && <img src={a.thumb} alt="" />}</span>
                  <span style={{ overflowWrap: "anywhere" }}>{a.title}</span>
                  <span className="seg" style={{ flexWrap: "nowrap" }}>
                    {(["up", "down"] as const).map((dir) => (
                      <form key={dir} action={moveMedia} className="inline-form">
                        {hidden}
                        <input type="hidden" name="media_id" value={a.media_id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button type="submit" className="os-btn os-btn--ghost os-btn--sm os-btn--icon" aria-label={`Move ${a.title} ${dir === "up" ? "earlier" : "later"}`} disabled={(dir === "up" && i === 0) || (dir === "down" && i === attached.length - 1)}>
                          <Icon name={dir === "up" ? "chevron-left" : "chevron-right"} size={18} style={{ transform: "rotate(90deg)" }} />
                        </button>
                      </form>
                    ))}
                    <form action={detachMedia} className="inline-form">
                      {hidden}
                      <input type="hidden" name="media_id" value={a.media_id} />
                      <button type="submit" className="os-btn os-btn--ghost os-btn--sm os-btn--icon" aria-label={`Remove ${a.title}`}><Icon name="x" size={18} /></button>
                    </form>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <form action={attachMedia} className="stack">
            {hidden}
            <MediaPicker name="media_ids" label="Add photos or videos" items={images.filter((m) => !attachedIds.has(m.id))} multiple doneLabel="Choose" />
            <div><button type="submit" className="os-btn os-btn--primary os-btn--md"><span>Add chosen media</span></button></div>
          </form>
        </section>
      )}

      {ent.key === "notes" && !isNew && (
        <section className="card stack" aria-label="Clue">
          <h2 className="card-title">Question before opening (optional)</h2>
          <p className="caption" style={{ fontSize: 15 }}>
            She has to answer a question only she'd know before this note opens. {clue ? <>Current question: <b>{clue}</b></> : "No question is set."} The answer is stored scrambled, so even you can't read it back. After eight wrong tries she has to wait ten minutes.
          </p>
          <ActionForm action={saveNoteClue} submitLabel={clue ? "Replace question" : "Save question"}>
            <input type="hidden" name="note_id" value={id} />
            <div className="field"><label htmlFor="clue">Question</label><input id="clue" type="text" name="clue" maxLength={300} placeholder="Where did we have our first coffee?" /></div>
            <div className="field"><label htmlFor="answer">Answer</label><input id="answer" type="text" name="answer" maxLength={200} autoComplete="off" /><span className="help">Capital letters and spaces at the ends don't matter.</span></div>
          </ActionForm>
          {clue && (
            <form action={async (fd: FormData) => { "use server"; await saveNoteClue(undefined, fd); }}>
              <input type="hidden" name="note_id" value={id} />
              <input type="hidden" name="clear" value="1" />
              <ConfirmButton message="Remove the question? The note will open without it." icon="unlock" danger={false}>Remove the question</ConfirmButton>
            </form>
          )}
        </section>
      )}

      {!isNew && (
        <form action={deleteEntity}>
          {hidden}
          <ConfirmButton message={`Delete this ${ent.singular} for good? Photos in your library are kept.`}>Delete {ent.singular}</ConfirmButton>
        </form>
      )}
    </>
  );
}
