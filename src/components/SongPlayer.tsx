"use client";

import PhotoCarousel, { type CarouselPhoto } from "@/components/PhotoCarousel";
import { useState } from "react";
import { Button, SongCard } from "@/components/ui";
import { embedUrl } from "@/lib/text";

type Song = { id: string; title: string; artist: string; source_type: string; source_url: string | null; dedication: string };
const LABEL: Record<string, string> = { spotify: "Spotify", youtube: "YouTube", apple: "Apple Music", file: "Audio file", link: "Link" };

/** Nothing plays until she taps. Spotify/YouTube load their own embed after the tap; files use a native audio control. */
export default function SongPlayer({ song, audioUrl, featured, collection, coverUrl, coverPosition, coverPhotos, track = 1 }: { song: Song; audioUrl?: string; featured?: boolean; collection?: boolean; coverUrl?: string; coverPosition?: string; coverPhotos?: CarouselPhoto[]; track?: number }) {
  const [started, setStarted] = useState(false);
  const embed = embedUrl(song.source_url);
  const canPlayHere = !!(song.source_type === "file" ? audioUrl : embed);
  const action = canPlayHere ? (
    <Button iconOnly variant={started ? "quiet" : "primary"} icon={started ? "x" : "play"}
      label={started ? `Close player for ${song.title}` : `Play ${song.title}`} onClick={() => setStarted((v) => !v)} />
  ) : song.source_url ? (
    <a className="os-btn os-btn--quiet os-btn--md os-btn--icon btnlink" href={song.source_url} target="_blank" rel="noopener noreferrer"
      aria-label={`Open ${song.title} in ${LABEL[song.source_type] ?? "the app"}`}><span aria-hidden="true">↗</span></a>
  ) : null;
  const player = <>
    {started && song.source_type === "file" && audioUrl && <audio controls autoPlay src={audioUrl} style={{ width: "100%" }}>Your browser can't play this audio.</audio>}
    {started && embed && <iframe title={`Play ${song.title}`} src={embed.src} height={embed.height} width="100%" style={{ border: 0, borderRadius: 16 }}
      allow="autoplay; encrypted-media; clipboard-write" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />}
    {!canPlayHere && !song.source_url && <p className="caption">Audio is not available yet.</p>}
  </>;
  if (collection) return (
    <article className={`song-sleeve${featured ? " song-sleeve--featured" : ""}`} aria-label={`Song: ${song.title}`} data-tone={(track - 1) % 3}>
      <div className="song-sleeve__art">
        {coverPhotos?.length ? <PhotoCarousel photos={coverPhotos} label={`${song.title} artwork`} /> : coverUrl ? <PhotoCarousel photos={[{ id: song.id, src: coverUrl, alt: "", focal: coverPosition }]} label={`${song.title} artwork`} /> : <>
          <span className="song-sleeve__edition">JUST US. / VOL. {String(track).padStart(2, "0")}</span>
          <span className="song-sleeve__vinyl os-song__disc"><span className="os-song__hole" /></span>
          <span className="song-sleeve__signature hand">a little of us</span>
        </>}
        {featured && <span className="song-sleeve__badge"><span>♥</span> On repeat</span>}
      </div>
      <div className="song-sleeve__details">
        <p className="song-sleeve__meta"><span>TRACK {String(track).padStart(2, "0")}</span><span>{LABEL[song.source_type] ?? "Link"}</span></p>
        <div className="song-sleeve__title"><div><h2 className="card-title">{song.title}</h2><p className="caption">{song.artist}</p></div>{action}</div>
        {song.dedication && <p className="song-sleeve__dedication hand">{song.dedication}</p>}
      </div>
      <div className="song-sleeve__player">{player}</div>
    </article>
  );
  return (
    <section className="stack" aria-label={`Song: ${song.title}`}>
      <SongCard featured={featured} title={song.title} artist={song.artist} source={LABEL[song.source_type] ?? "Link"} dedication={song.dedication ? song.dedication.split("\n")[0] : undefined}
        action={action} coverUrl={coverUrl ?? coverPhotos?.[0]?.src} coverPosition={coverPosition ?? coverPhotos?.[0]?.focal} />
      {player}
      {song.dedication && song.dedication.includes("\n") && <p className="hand" style={{ color: "var(--accent-text)" }}>{song.dedication}</p>}
    </section>
  );
}
