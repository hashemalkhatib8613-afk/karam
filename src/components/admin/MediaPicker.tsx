"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui";

export type PickerItem = { id: string; title: string; kind: string; thumb: string | null };

/**
 * Pick one or many library items. Writes the chosen ids (comma separated) into a hidden input
 * so it works inside a normal <form> posted to a server action.
 */
export default function MediaPicker({
  name,
  items,
  initial = [],
  multiple = false,
  label,
  help,
  doneLabel = "Use selected",
}: {
  name: string;
  items: PickerItem[];
  initial?: string[];
  multiple?: boolean;
  label: string;
  help?: string;
  doneLabel?: string;
}) {
  const dlg = useRef<HTMLDialogElement>(null);
  const [sel, setSel] = useState<string[]>(initial);
  const [draft, setDraft] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const byId = new Map(items.map((i) => [i.id, i]));
  const shown = items.filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase()));

  const open = () => {
    setDraft(sel);
    setQ("");
    dlg.current?.showModal();
  };
  const toggle = (id: string) => setDraft((d) => (multiple ? (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]) : [id]));
  const done = () => {
    setSel(draft);
    dlg.current?.close();
  };

  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className="pick">
        <input type="hidden" name={name} value={sel.join(",")} />
        <div className="pick__sel">
          {sel.map((id) => {
            const it = byId.get(id);
            return (
              <span key={id} className="pick__thumb" title={it?.title ?? "Selected file"}>
                {it?.thumb ? <img src={it.thumb} alt="" /> : <span style={{ display: "grid", placeItems: "center", height: "100%" }}><Icon name={it?.kind === "audio" ? "music" : "image"} size={24} /></span>}
              </span>
            );
          })}
          {!multiple && sel[0] && <span className="caption">{byId.get(sel[0])?.title ?? "Selected file"}</span>}
          {!sel.length && <span className="caption">{multiple ? "Nothing chosen yet." : "None chosen."}</span>}
        </div>
        <div className="seg">
          <button type="button" className="os-btn os-btn--quiet os-btn--sm" onClick={open}>
            <Icon name="image" size={18} /><span>{sel.length && !multiple ? "Change" : multiple ? "Choose from library" : "Choose"}</span>
          </button>
          {!multiple && sel.length > 0 && (
            <button type="button" className="os-btn os-btn--ghost os-btn--sm" onClick={() => setSel([])}>
              <Icon name="x" size={18} /><span>Remove</span>
            </button>
          )}
        </div>
      </div>
      {!multiple && sel[0] && byId.get(sel[0])?.kind === "image" && <a className="help" href={`/admin/media/${sel[0]}`}>Edit photo / add carousel photos</a>}
      {help && <span className="help">{help}</span>}

      <dialog ref={dlg} className="pickdlg" aria-label={label}>
        <div className="pickdlg__in">
          <div className="adm__head">
            <h2 className="card-title">{label}</h2>
            <button type="button" className="os-btn os-btn--ghost os-btn--sm os-btn--icon" aria-label="Close" onClick={() => dlg.current?.close()}><Icon name="x" size={20} /></button>
          </div>
          <div className="field">
            <label htmlFor={name + "-q"}>Search by name</label>
            <input id={name + "-q"} type="text" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} autoComplete="off" />
          </div>
          {shown.length === 0 ? (
            <p className="caption">Nothing here yet. Add files in the Media Library first.</p>
          ) : (
            <div className="pickdlg__grid">
              {shown.map((i) => {
                const on = draft.includes(i.id);
                return (
                  <button key={i.id} type="button" className="pickdlg__item" aria-pressed={on} onClick={() => toggle(i.id)}>
                    <span className="pick__thumb" style={{ width: "100%", height: 96 }}>
                      {i.thumb ? <img src={i.thumb} alt="" /> : <span style={{ display: "grid", placeItems: "center", height: "100%" }}><Icon name={i.kind === "audio" ? "music" : "image"} size={28} /></span>}
                    </span>
                    {on && <span className="tick"><Icon name="check" size={14} /></span>}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.kind === "video" ? "Video · " : ""}{i.title}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="seg">
            <button type="button" className="os-btn os-btn--primary os-btn--md" onClick={done}><span>{multiple ? `${doneLabel} (${draft.length})` : doneLabel}</span></button>
            <button type="button" className="os-btn os-btn--ghost os-btn--md" onClick={() => dlg.current?.close()}><span>Cancel</span></button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
