"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerAsset } from "@/app/actions/admin";
import { Icon } from "@/components/ui";

type Item = { key: string; file: File; status: "queued" | "working" | "done" | "failed"; note?: string };

const MAX_EDGE = 2400;
const THUMB_EDGE = 480;
const MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode image"))), type, quality));
}

async function resize(bitmap: ImageBitmap, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  let blob = await toBlob(canvas, "image/webp", quality);
  if (blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality); // very old browsers
  return { blob, w, h };
}

const extOf = (mime: string) => (mime === "image/webp" ? "webp" : mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin");

function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    const end = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    const t = setTimeout(() => end(null), 4000);
    a.preload = "metadata";
    a.onloadedmetadata = () => { clearTimeout(t); end(Number.isFinite(a.duration) ? Math.round(a.duration) : null); };
    a.onerror = () => { clearTimeout(t); end(null); };
    a.src = url;
  });
}

function videoMetadata(file: File): Promise<{ duration: number | null; width: number | null; height: number | null; poster: Blob | null }> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let finished = false;
    const finish = (poster: Blob | null = null) => {
      if (finished) return;
      finished = true;
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : null;
      const width = video.videoWidth || null;
      const height = video.videoHeight || null;
      clearTimeout(timer);
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve({ duration, width, height, poster });
    };
    const timer = setTimeout(() => finish(), 8000);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = async () => {
      try {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, THUMB_EDGE / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(await toBlob(canvas, "image/jpeg", 0.8));
      } catch { finish(); }
    };
    video.onerror = () => finish();
    video.src = url;
  });
}

export default function Uploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = (key: string, p: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function processOne(it: Item) {
    const supabase = createClient();
    const { file } = it;
    patch(it.key, { status: "working", note: undefined });
    const uploaded: string[] = [];
    try {
      if (file.size > MAX_BYTES) throw new Error("Files can be up to 50 MB.");
      const year = new Date().getFullYear();
      const id = crypto.randomUUID();
      const base = `uploads/${year}/${id}`;
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "Untitled";
      const put = async (path: string, blob: Blob, contentType: string) => {
        const { error } = await supabase.storage.from("media").upload(path, blob, { contentType, cacheControl: "31536000", upsert: false });
        if (error) throw new Error(error.message);
        uploaded.push(path);
      };

      let input: Parameters<typeof registerAsset>[0];
      if (VIDEO_TYPES.includes(file.type)) {
        const meta = await videoMetadata(file);
        const path = `${base}.${file.type === "video/quicktime" ? "mov" : extOf(file.type)}`;
        await put(path, file, file.type);
        const thumbPath = meta.poster ? `${base}_t.jpg` : null;
        if (thumbPath && meta.poster) await put(thumbPath, meta.poster, "image/jpeg");
        input = { path, thumbPath, mime: file.type, size: file.size, duration: meta.duration,
          width: meta.width, height: meta.height, title };
      } else if (file.type.startsWith("audio/")) {
        const duration = await audioDuration(file);
        const path = `${base}.${extOf(file.type)}`;
        await put(path, file, file.type);
        input = { path, mime: file.type, size: file.size, duration, title };
      } else if (file.type === "image/gif") {
        const path = `${base}.gif`;
        await put(path, file, "image/gif");
        input = { path, mime: "image/gif", size: file.size, title };
      } else if (file.type.startsWith("image/")) {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        } catch {
          throw new Error("This photo format can't be read here. Export it as JPG or PNG and try again.");
        }
        const main = await resize(bitmap, MAX_EDGE, 0.86);
        const thumb = await resize(bitmap, THUMB_EDGE, 0.8);
        bitmap.close?.();
        const path = `${base}.${extOf(main.blob.type)}`;
        const thumbPath = `${base}_t.${extOf(thumb.blob.type)}`;
        await put(path, main.blob, main.blob.type);
        await put(thumbPath, thumb.blob, thumb.blob.type);
        let originalPath: string | null = null;
        if (keepOriginal && ["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          originalPath = `${base}_orig.${extOf(file.type)}`;
          await put(originalPath, file, file.type);
        }
        input = { path, thumbPath, originalPath, mime: main.blob.type, size: main.blob.size, width: main.w, height: main.h, title };
      } else {
        throw new Error("Use a photo, audio file, or MP4, WebM, or MOV video.");
      }

      const res = await registerAsset(input);
      if (res.ok === false) throw new Error(res.error);
      patch(it.key, { status: "done" });
    } catch (e: any) {
      if (uploaded.length) await supabase.storage.from("media").remove(uploaded).catch(() => {});
      patch(it.key, { status: "failed", note: e?.message || "Upload failed." });
    }
  }

  async function run(list: Item[]) {
    setBusy(true);
    for (const it of list) await processOne(it);
    setBusy(false);
    router.refresh();
  }

  function add(files: FileList | File[]) {
    const fresh: Item[] = Array.from(files).map((file) => ({ key: crypto.randomUUID(), file, status: "queued" }));
    if (!fresh.length) return;
    setItems((all) => [...fresh, ...all]);
    void run(fresh);
  }

  const failed = items.filter((i) => i.status === "failed");

  return (
    <section className="stack" aria-label="Add files">
      <div
        className={`dropzone${over ? " is-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
      >
        <Icon name="upload" size={32} />
        <p style={{ margin: "8px 0 12px" }}>Drag photos, audio, or videos here, or choose them from your device. Up to 50 MB per file.</p>
        <button type="button" className="os-btn os-btn--primary os-btn--md" onClick={() => input.current?.click()} disabled={busy}>
          <Icon name="plus" size={20} /><span>Choose files</span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,video/mp4,video/webm,video/quicktime"
          onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} />
        Also keep the full-size original (uses more of the free 1 GB of storage)
      </label>

      {items.length > 0 && (
        <ul className="attached" aria-live="polite">
          {items.map((i) => (
            <li key={i.key} style={{ gridTemplateColumns: "1fr auto" }}>
              <span>
                <b style={{ overflowWrap: "anywhere" }}>{i.file.name}</b>
                <br />
                <span className="caption">
                  {i.status === "queued" && "Waiting…"}
                  {i.status === "working" && "Resizing and uploading…"}
                  {i.status === "done" && "Added to your library."}
                  {i.status === "failed" && (i.note ?? "Failed.")}
                </span>
              </span>
              <span>
                {i.status === "done" && <Icon name="check" size={22} label="Done" />}
                {i.status === "working" && <span className="os-spinner" aria-hidden="true" />}
                {i.status === "failed" && (
                  <button type="button" className="os-btn os-btn--quiet os-btn--sm" disabled={busy} onClick={() => void run([i])}>
                    <Icon name="refresh" size={16} /><span>Try again</span>
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {failed.length > 1 && !busy && (
        <button type="button" className="os-btn os-btn--quiet os-btn--sm" onClick={() => void run(failed)}>
          <Icon name="refresh" size={16} /><span>Retry all failed ({failed.length})</span>
        </button>
      )}
    </section>
  );
}
