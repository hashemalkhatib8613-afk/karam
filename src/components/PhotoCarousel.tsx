"use client";

import { useId, useRef, useState } from "react";
import { PhotoDownloadLink } from "@/components/PhotoDownloads";

export type CarouselPhoto = {
  id: string; src: string; alt: string; width?: number | null; height?: number | null;
  focal?: string; full?: string; caption?: string; kind?: "image" | "video";
};

/** One grid row measures every slide, including offscreen photos, so swiping never changes height. */
export default function PhotoCarousel({ photos, label = "Photos", className = "", onOpen }: {
  photos: CarouselPhoto[]; label?: string; className?: string; onOpen?: (index: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const id = useId();
  const [active, setActive] = useState(0);
  const move = (index: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: el.clientWidth * index, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  if (!photos.length) return null;
  return (
    <div className={`photo-carousel photo-frame ${className}`} role="region" aria-roledescription="carousel" aria-label={label}>
      <div className="photo-carousel__track" id={id} ref={track} tabIndex={photos.length > 1 ? 0 : undefined}
        onScroll={() => { const el = track.current; if (el?.clientWidth) setActive(Math.round(el.scrollLeft / el.clientWidth)); }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault(); e.stopPropagation();
          move(Math.max(0, Math.min(photos.length - 1, active + (e.key === "ArrowRight" ? 1 : -1))));
        }}>
        {photos.map((photo, i) => {
          const image = photo.kind === "video"
            ? <video controls autoPlay={i === active} muted loop preload={i === active ? "metadata" : "none"} playsInline poster={photo.src !== photo.full ? photo.src : undefined}
                src={i === active ? photo.full : undefined} aria-label={photo.alt || `Video ${i + 1}`} />
            : <img src={photo.src} alt={photo.alt} width={photo.width || undefined} height={photo.height || undefined}
                loading={i === 0 ? "eager" : "lazy"} decoding="async" draggable={false} style={{ objectPosition: photo.focal }} />;
          return <div key={photo.id} className="photo-carousel__slide" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${photos.length}`}>
            {onOpen && photo.kind !== "video" ? <button type="button" className="photo-carousel__open" aria-label={`Open photo ${i + 1}${photo.alt ? `: ${photo.alt}` : ""}`} onClick={() => onOpen(i)}>{image}</button> : image}
          </div>;
        })}
      </div>
      {photos.length > 1 && <div className="photo-carousel__controls">
        <button type="button" aria-label="Previous photo" aria-controls={id} disabled={active === 0} onClick={() => move(active - 1)}>‹</button>
        <span className="caption" aria-live="polite" aria-atomic="true">{active + 1} / {photos.length}</span>
        <button type="button" aria-label="Next photo" aria-controls={id} disabled={active === photos.length - 1} onClick={() => move(active + 1)}>›</button>
      </div>}
      {!onOpen && photos[active]?.kind !== "video" && photos[active] && <PhotoDownloadLink id={photos[active].id} />}
    </div>
  );
}
