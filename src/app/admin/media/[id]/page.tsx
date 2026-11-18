import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { signPaths } from "@/lib/media";
import { isUuid } from "@/lib/text";
import { assetUsage } from "@/lib/usage";
import { updateAsset, deleteAsset, saveCarousel } from "@/app/actions/admin";
import MediaPicker from "@/components/admin/MediaPicker";
import { loadPickerAssets } from "@/lib/picker";
import ActionForm from "@/components/admin/ActionForm";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Icon } from "@/components/ui";

export const metadata = { title: "Edit file" };

export default async function MediaEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ blocked?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireAdmin();
  const { data: a } = await supabase.from("media_assets").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();
  const [urls, usage] = await Promise.all([signPaths(supabase, [a.storage_path]), assetUsage(supabase, id)]);
  const src = urls[a.storage_path];
  const [picker, { data: carousel }] = a.kind === "image" || a.kind === "video" ? await Promise.all([
    loadPickerAssets(supabase),
    supabase.from("media_carousel_photos").select("media_id").eq("lead_asset_id", id).order("sort_order"),
  ]) : [[], { data: [] }];

  return (
    <>
      <header className="adm__head">
        <div className="page-head" style={{ padding: 0 }}>
          <p className="overline"><Link href="/admin/media">Media Library</Link></p>
          <h1 className="h1">{a.title || "Untitled"}</h1>
        </div>
      </header>

      {sp.blocked && (
        <p className="err" role="alert"><Icon name="alert" size={18} />This file is still in use, so it can't be deleted. Remove it from the places listed below first.</p>
      )}

      <div className="card stack" style={{ maxWidth: 720 }}>
        {a.kind === "image" && src && <img src={src} alt={a.alt_text || ""} style={{ maxWidth: "100%", maxHeight: 420, objectFit: "contain", borderRadius: "var(--radius-md)" }} />}
        {a.kind === "audio" && src && <audio controls src={src} style={{ width: "100%" }} />}
        {a.kind === "video" && src && <video controls playsInline preload="metadata" src={src} style={{ width: "100%", maxHeight: 420 }} />}
        <p className="caption">
          {a.mime_type} · {(a.file_size / 1024 / 1024).toFixed(2)} MB{a.width ? ` · ${a.width}×${a.height}` : ""}{a.duration_seconds ? ` · ${Math.floor(a.duration_seconds / 60)}:${String(Math.round(a.duration_seconds % 60)).padStart(2, "0")}` : ""}
        </p>
      </div>

      {(a.kind === "image" || a.kind === "video") && <section className="card stack" style={{ maxWidth: 720 }}>
        <h2 className="card-title">Photo and video carousel</h2>
        <p className="caption">This file appears first. Add more photos or videos to swipe through wherever it is shown.</p>
        <ActionForm action={saveCarousel} submitLabel="Save carousel">
          <input type="hidden" name="id" value={a.id} />
          <MediaPicker name="carousel_photos" label="More photos or videos in this card" multiple
            items={picker.filter((p) => (p.kind === "image" || p.kind === "video") && p.id !== id)} initial={(carousel ?? []).map((p) => p.media_id)}
            help="Files appear in selection order. Deselect a file to remove it. Each added file is shown on its own; its own carousel is not included." />
        </ActionForm>
      </section>}

      <ActionForm action={updateAsset}>
        <input type="hidden" name="id" value={a.id} />
        <div className="field"><label htmlFor="title">Name</label><input id="title" type="text" name="title" defaultValue={a.title} maxLength={200} /></div>
        <div className="field">
          <label htmlFor="alt_text">Describe the photo or video (for screen readers)</label>
          <input id="alt_text" type="text" name="alt_text" defaultValue={a.alt_text} maxLength={500} />
          <span className="help">One short sentence, e.g. “The two of us laughing on the pier at sunset.”</span>
        </div>
        <div className="field"><label htmlFor="caption">Caption</label><textarea id="caption" name="caption" rows={2} defaultValue={a.caption} maxLength={1000} /></div>
        <div className="field"><label htmlFor="taken_at">Date taken</label><input id="taken_at" type="date" name="taken_at" defaultValue={a.taken_at ?? ""} /></div>
        <div className="field"><label htmlFor="location_text">Place</label><input id="location_text" type="text" name="location_text" defaultValue={a.location_text} maxLength={200} /></div>
        <div className="field"><label htmlFor="tags">Tags</label><input id="tags" type="text" name="tags" defaultValue={(a.tags ?? []).join(", ")} /><span className="help">Separate with commas.</span></div>
        {a.kind === "image" && (
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="lbl">Focus point when the photo is cropped</legend>
            <div className="seg">
              <div className="field"><label htmlFor="focal_x">Left–right (0–100)</label><input id="focal_x" type="number" name="focal_x" min={0} max={100} defaultValue={Number(a.focal_x)} /></div>
              <div className="field"><label htmlFor="focal_y">Top–bottom (0–100)</label><input id="focal_y" type="number" name="focal_y" min={0} max={100} defaultValue={Number(a.focal_y)} /></div>
            </div>
            <span className="help">50 and 50 is the centre. Lower the second number to keep faces near the top in the frame.</span>
          </fieldset>
        )}
      </ActionForm>

      <section className="card stack" aria-label="Where this file is used" style={{ maxWidth: 720 }}>
        <h2 className="card-title">Where it's used</h2>
        {usage.length === 0 ? (
          <p className="caption" style={{ fontSize: 15 }}>Nowhere yet. It's safe to delete.</p>
        ) : (
          <ul className="stack">
            {usage.map((u, i) => (
              <li key={i}><span className="caption">{u.kind}</span> · <Link href={u.href}>{u.title || "Untitled"}</Link></li>
            ))}
          </ul>
        )}
        <form action={deleteAsset}>
          <input type="hidden" name="id" value={a.id} />
          <ConfirmButton message="Delete this file for good? This can't be undone.">Delete file</ConfirmButton>
        </form>
      </section>
    </>
  );
}
