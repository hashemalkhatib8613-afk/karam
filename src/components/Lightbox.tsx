"use client";

import PhotoCarousel, { type CarouselPhoto } from "@/components/PhotoCarousel";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, HeartButton } from "@/components/ui";
import { myReactions, toggleReaction } from "@/app/actions/partner";
import { PhotoDownloadLink } from "@/components/PhotoDownloads";

export type LightboxItem = { id: string; thumb: string; full: string; alt: string; caption?: string; focal?: string; kind?: "image" | "video"; photos?: CarouselPhoto[] };
export type AlbumLayout = "grid-2" | "grid-3" | "masonry" | "polaroid" | "collage";
export type MediaAspect = "natural" | "square" | "landscape" | "wide" | "portrait";

const ALBUM_LAYOUTS = new Set<AlbumLayout>(["grid-2", "grid-3", "masonry", "polaroid", "collage"]);
const MEDIA_ASPECTS = new Set<MediaAspect>(["natural", "square", "landscape", "wide", "portrait"]);

/** Thumbnail grid + full-screen viewer. Every swipe has buttons; arrow keys and Esc work; focus returns on close. */
export default function Lightbox({ items, targetType = "media", label, uniformMedia = false, albumLayout, mediaAspect }: {
  items: LightboxItem[]; targetType?: string; label: string; uniformMedia?: boolean; albumLayout?: string; mediaAspect?: string;
}) {
  const layout: AlbumLayout | null = albumLayout === undefined
    ? null
    : ALBUM_LAYOUTS.has(albumLayout as AlbumLayout) ? albumLayout as AlbumLayout : "grid-2";
  const aspect: MediaAspect | null = mediaAspect === undefined
    ? uniformMedia ? "square" : null
    : MEDIA_ASPECTS.has(mediaAspect as MediaAspect) ? mediaAspect as MediaAspect : "square";
  const viewerItems = items.flatMap((item) => item.photos?.length ? item.photos.map((p) => ({ ...item, id: p.id, thumb: p.src, full: p.full || p.src, alt: p.alt, caption: p.caption, kind: p.kind })) : [item]);
  const [open, setOpen] = useState<number | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const opener = useRef<HTMLElement | null>(null);
  const viewer = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    myReactions(targetType, items.flatMap((i) => i.photos?.length ? i.photos.map((p) => p.id) : [i.id])).then((ids) => setLiked(new Set(ids))).catch(() => {});
  }, [items, targetType]);

  const close = useCallback(() => {
    viewer.current?.close();
    setOpen(null);
    opener.current?.focus();
  }, []);
  const go = useCallback((d: number) => setOpen((o) => (o == null ? o : (o + d + viewerItems.length) % viewerItems.length)), [viewerItems.length]);

  useEffect(() => {
    if (open == null) return;
    if (!viewer.current?.open) viewer.current?.showModal();
    viewer.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close, go]);

  const cur = open != null ? viewerItems[open] : null;
  return (
    <section className={`lightbox-grid${aspect && aspect !== "natural" ? ` lightbox-grid--uniform lightbox-grid--${aspect}` : ""}${layout ? ` album-gallery album-gallery--${layout}` : ""}`} aria-label={label}>
      <ul className={layout ? "album-gallery__items" : "grid3"}>
        {items.map((it, i) => (
          <li key={it.id}>
            <PhotoCarousel photos={it.photos?.length ? it.photos : [{ id: it.id, src: it.thumb, full: it.full, alt: it.alt, kind: it.kind }]}
              label={it.alt || `Media card ${i + 1}`}
              onOpen={(slide) => {
                opener.current = document.activeElement as HTMLElement;
                setOpen(items.slice(0, i).reduce((n, item) => n + (item.photos?.length || 1), 0) + slide);
              }} />
          </li>
        ))}
      </ul>
      {cur && (
        <dialog className="viewer" ref={viewer} aria-label="Photo viewer" onCancel={(e) => { e.preventDefault(); close(); }}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => { if (touchX.current != null) { const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); touchX.current = null; } }}>
          <div className="viewer__bar">
            <Button iconOnly variant="ghost" icon="x" label="Close viewer" onClick={close} />
            <span className="caption" style={{ color: "#fff" }} aria-live="polite">{(open ?? 0) + 1} / {viewerItems.length}</span>
            <HeartButton key={cur.id} pressed={liked.has(cur.id)} label="Love this photo"
              onChange={() => { toggleReaction(targetType, cur.id).then((r) => setLiked((s) => { const n = new Set(s); r.on ? n.add(cur.id) : n.delete(cur.id); return n; })); }} />
          </div>
          <div className="viewer__img">{cur.kind === "video" ? <video key={cur.id} controls autoPlay muted loop playsInline preload="metadata" src={cur.full} poster={cur.thumb !== cur.full ? cur.thumb : undefined} aria-label={cur.alt || "Video"} /> : <img src={cur.full} alt={cur.alt} />}</div>
          <div className="viewer__cap">{cur.caption && <p>{cur.caption}</p>}{cur.kind !== "video" && <PhotoDownloadLink id={cur.id} />}</div>
          <div className="viewer__bar" style={{ justifyContent: "center", gap: 24 }}>
            <Button iconOnly variant="ghost" icon="chevron-left" label="Previous photo" onClick={() => go(-1)} />
            <Button iconOnly variant="ghost" icon="chevron-right" label="Next photo" onClick={() => go(1)} />
          </div>
        </dialog>
      )}
    </section>
  );
}
