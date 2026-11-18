"use client";
// @ts-nocheck
// Ported from the Just Us. design system bundle (components/bundle.js). Keep in sync with the design system.
import PhotoCarousel from "@/components/PhotoCarousel";
import React, { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
const cx = (...a) => a.filter(Boolean).join(" ");

/* ---------- Icon ---------- */
const P = {
  heart: "M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z",
  envelope: "M3.5 6.5h17v11h-17z M3.5 7l8.5 6.5L20.5 7",
  music: "M9 18V6l10-2v12 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  image: "M3.5 5.5h17v13h-17z M3.5 15l5-5 4 4 3-3 5 5 M15.5 9.5h.01",
  phone: "M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4.5 5.5a2 2 0 0 1 2-2z",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z",
  home: "M4 11l8-6.5 8 6.5 M6 9.5V20h12V9.5 M10 20v-5h4v5",
  book: "M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z M12 6.5v13",
  menu: "M5 7h14 M5 12h14 M5 17h14",
  more: "M6 12h.01 M12 12h.01 M18 12h.01",
  lock: "M6.5 11h11v8.5h-11z M8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  unlock: "M6.5 11h11v8.5h-11z M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2",
  play: "M8 5.5v13l10-6.5z",
  pause: "M8.5 5.5v13 M15.5 5.5v13",
  gift: "M4.5 10h15v10h-15z M3.5 7h17v3h-17z M12 7v13 M12 7c-1-3-5-3.5-5-1.5S10 7 12 7z M12 7c1-3 5-3.5 5-1.5S14 7 12 7z",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  "eye-off": "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M4 4l16 16",
  drag: "M9 6h.01 M15 6h.01 M9 12h.01 M15 12h.01 M9 18h.01 M15 18h.01",
  sliders: "M4 7h10 M18 7h2 M4 17h2 M10 17h10 M16 5v4 M8 15v4",
  copy: "M8.5 8.5h11v11h-11z M5.5 15.5v-11h11",
  trash: "M5 7h14 M9.5 7V4.5h5V7 M7 7l1 13h8l1-13",
  upload: "M12 16V5 M7.5 9.5L12 5l4.5 4.5 M4.5 15v4.5h15V15",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12 M18 6L6 18",
  search: "M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M16 16l4 4",
  calendar: "M4.5 6.5h15v13h-15z M4.5 10.5h15 M8.5 4v4 M15.5 4v4",
  "chevron-right": "M9.5 5.5L16 12l-6.5 6.5",
  "chevron-left": "M14.5 5.5L8 12l6.5 6.5",
  "chevron-down": "M5.5 9.5L12 16l6.5-6.5",
  clock: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 8v4.5l3 1.5",
  wave: "M12 4v16 M8 8v8 M4 11v2 M16 8v8 M20 11v2",
  alert: "M12 4l9 15.5H3z M12 10v4 M12 17h.01",
  archive: "M4 6.5h16v4H4z M5.5 10.5V19h13v-8.5 M10 14h4",
  grid: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  users: "M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5 M16 5.5a3.5 3.5 0 0 1 0 6.5 M18 14.5c2 .6 3 2.5 3.5 5",
  palette: "M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 0 0 3-3 8.5 8.5 0 0 0-8-10z M8 11h.01 M11 7.5h.01 M15.5 8.5h.01",
  layers: "M12 4l8.5 4.5L12 13 3.5 8.5z M3.5 12.5L12 17l8.5-4.5 M3.5 16.5L12 21l8.5-4.5",
  volume: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z M16 9a4 4 0 0 1 0 6",
  plus: "M12 5v14 M5 12h14",
  refresh: "M19 8a7.5 7.5 0 0 0-13-1.5L4.5 8 M4.5 4v4h4 M5 16a7.5 7.5 0 0 0 13 1.5l1.5-1.5 M19.5 20v-4h-4",
  external: "M14 4.5h5.5V10 M19.5 4.5L11 13 M18 14v5.5H5V6.5h5.5",
  history: "M4 12a8 8 0 1 0 2.5-5.8L4 8.5 M4 4v4.5h4.5 M12 8v4.5l3 1.5",
  wifi: "M3 9.5a14 14 0 0 1 18 0 M6 13a9.5 9.5 0 0 1 12 0 M9 16.5a5 5 0 0 1 6 0 M12 20h.01",
};
function Icon({ name, size = 24, label, filled, className, style }) {
  const d = P[name] || P.heart;
  const fill = filled || name === "play";
  return (
    <svg className={cx("os-icon", className)} width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={name === "drag" || name === "more" ? 2.6 : 1.6} strokeLinecap="round" strokeLinejoin="round"
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={style}>
      <path d={d} />
    </svg>
  );
}

/* ---------- Brand ---------- */
function Wordmark({ name = "just us.", heart = true, size = "md" }) {
  return (
    <span className={cx("os-wordmark", "os-wordmark--" + size)}>
      {name}
      {heart && <Icon name="heart" size={size === "lg" ? 22 : 14} filled className="os-wordmark__heart" />}
      {heart && <span className="os-sr">heart</span>}
    </span>
  );
}

/* ---------- Actions ---------- */
function Button({ variant = "primary", size = "md", icon, iconRight, iconOnly, loading, disabled, children, label, onClick, type = "button", full }: {
  variant?: string; size?: string; icon?: string; iconRight?: string; iconOnly?: boolean; loading?: boolean;
  disabled?: boolean; children?: React.ReactNode; label?: string; onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset"; full?: boolean;
}) {
  return (
    <button type={type} className={cx("os-btn", "os-btn--" + variant, "os-btn--" + size, full && "os-btn--full", iconOnly && "os-btn--icon", loading && "is-loading")}
      disabled={disabled || loading} aria-busy={loading || undefined} aria-label={iconOnly ? label : undefined} onClick={onClick}>
      {loading ? <span className="os-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={20} />}
      {!iconOnly && <span>{loading ? "One moment…" : children}</span>}
      {!iconOnly && iconRight && !loading && <Icon name={iconRight} size={18} />}
    </button>
  );
}

function HeartButton({ pressed: p0 = false, count, label = "Love this memory", onChange }) {
  const [on, setOn] = useState(p0);
  const [burst, setBurst] = useState(0);
  const toggle = () => { const n = !on; setOn(n); if (n) setBurst((b) => b + 1); onChange && onChange(n); };
  return (
    <button type="button" className={cx("os-heart", on && "is-on")} aria-pressed={on} onClick={toggle}>
      <Icon name="heart" size={22} filled={on} />
      {burst > 0 && <span key={burst} className="os-heart__float" aria-hidden="true"><Icon name="heart" size={16} filled /></span>}
      <span className="os-sr">{label}</span>
      {count != null && <span className="os-heart__count">{count + (on && p0 === false ? 1 : 0)}</span>}
    </button>
  );
}

function Chip({ selected, icon, children, onClick }) {
  return (
    <button type="button" className={cx("os-chip", selected && "is-selected")} aria-pressed={!!selected} onClick={onClick}>
      {selected ? <Icon name="check" size={16} /> : icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}

function Toggle({ checked: c0 = false, label, onChange }) {
  const [on, setOn] = useState(c0);
  const id = useId();
  return (
    <label className="os-toggle" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={on} onChange={(e) => { setOn(e.target.checked); onChange && onChange(e.target.checked); }} />
      <span className="os-toggle__track" aria-hidden="true"><span className="os-toggle__thumb" /></span>
      <span className="os-toggle__label">{label}</span>
    </label>
  );
}

/* ---------- Forms ---------- */
function TextField({ label, type = "text", value, placeholder, helper, error, icon, defaultValue, disabled, name, required, autoComplete, minLength, maxLength }) {
  const id = useId();
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className={cx("os-field", error && "has-error", disabled && "is-disabled")}>
      <label className="os-field__label" htmlFor={id}>{label}</label>
      <div className="os-field__box">
        {icon && <Icon name={icon} size={20} className="os-field__icon" />}
        <input id={id} name={name} required={required} autoComplete={autoComplete} minLength={minLength} maxLength={maxLength} type={isPw && show ? "text" : type} defaultValue={defaultValue} value={value} placeholder={placeholder} disabled={disabled}
          aria-invalid={!!error} aria-describedby={id + "-h"} />
        {isPw && (
          <button type="button" className="os-field__toggle" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow(!show)}>
            <Icon name={show ? "eye-off" : "eye"} size={20} />
          </button>
        )}
      </div>
      {(error || helper) && (
        <p id={id + "-h"} className="os-field__help" role={error ? "alert" : undefined}>
          {error && <Icon name="alert" size={16} />}
          {error || helper}
        </p>
      )}
    </div>
  );
}

/* ---------- Photo + Polaroid ---------- */
function Photo({ tone = 1, aspect = "4 / 5", src, alt = "", label = "Sample photo", focal = "50% 50%", rounded = "lg", fill }) {
  return (
    <div className={cx("os-photo", src && "photo-frame", "os-photo--r-" + rounded, fill && "os-photo--fill")} data-tone={tone} style={{ aspectRatio: src || fill ? undefined : aspect }}
      role="img" aria-label={alt || label}>
      {src ? <img src={src} alt="" style={{ objectPosition: focal }} /> : label ? <span className="os-photo__tag">{label}</span> : null}
    </div>
  );
}

function Polaroid({ tone = 1, caption, date, tilt = -2, tape, children, alt, src, size }) {
  return (
    <figure className={cx("os-polaroid", size && "os-polaroid--" + size)} style={{ "--tilt": tilt + "deg" }}>
      {tape && <span className="os-polaroid__tape" aria-hidden="true" />}
      <Photo tone={tone} aspect="1 / 1" rounded="xs" alt={alt} src={src} />
      <figcaption className="os-polaroid__cap">
        {caption && <span className="hand">{caption}</span>}
        {date && <span className="os-polaroid__date">{date}</span>}
        {children}
      </figcaption>
    </figure>
  );
}

/* ---------- Envelope, seal, letter ---------- */
function WaxSeal({ size = 64 }) {
  const gradientId = useId();
  // Twelve soft scallops, all centered on the ring at (32, 32).
  const point = (radius, angle) => `${32 + radius * Math.cos(angle)},${32 + radius * Math.sin(angle)}`;
  const outline = `M32,5${Array.from({ length: 12 }, (_, i) => {
    const angle = -Math.PI / 2 + i * Math.PI / 6;
    return `Q${point(33, angle + Math.PI / 12)} ${point(27, angle + Math.PI / 6)}`;
  }).join("")}Z`;
  return (
    <svg className="os-seal" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" />
        </radialGradient>
      </defs>
      <path className="os-seal__body" d={outline} />
      <path d={outline} fill={`url(#${gradientId})`} />
      <circle cx="32" cy="32" r="19" className="os-seal__ring" fill="none" strokeWidth="1.4" />
      <path className="os-seal__heart" transform="translate(0 -2)" d="M32 44s-11-6.6-11-14.6A6.2 6.2 0 0 1 32 26a6.2 6.2 0 0 1 11 3.4C43 37.4 32 44 32 44z" />
    </svg>
  );
}

function Envelope({ state = "sealed", greeting = "For [HER_NAME], with all my love.", hint = "Tap the seal to open", onOpen, onOpened, children }: {
  state?: "sealed" | "opening" | "open";
  greeting?: string;
  hint?: string;
  onOpen?: () => void;
  onOpened?: () => void;
  children?: React.ReactNode;
}) {
  const open = state !== "sealed";
  return (
    <div className={cx("os-env", "is-" + state)} data-state={state}>
      <div className="os-env__scene">
        <div className="os-env__back" />
        <div className="os-env__letter" onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && state === "opening") onOpened?.();
        }}><div className="os-env__letter-in">{children || <span className="hand">{greeting}</span>}</div></div>
        <div className="os-env__front" />
        <div className="os-env__flap" />
        <button type="button" className="os-env__seal" onClick={onOpen} disabled={open} aria-label="Open your letter">
          <WaxSeal size={68} />
        </button>
      </div>
      <p className="os-env__to hand">{greeting}</p>
      <p className="os-env__hint caption" role="status">{state === "opening" ? "Opening your letter…" : open ? "Your letter is ready to read" : hint}</p>
    </div>
  );
}

function Letter({ to, children, signature, date, locked }) {
  return (
    <article className={cx("os-letter", locked && "is-locked")}>
      {date && <p className="os-letter__date hand">{date}</p>}
      {to && <h3 className="os-letter__to display-italic">{to}</h3>}
      <div className="os-letter__body body-lg">{children}</div>
      {signature && <p className="os-letter__sig signature">{signature}</p>}
    </article>
  );
}

/* ---------- Counter ---------- */
function RelationshipCounter({ days, since, next, sample }) {
  const empty = days == null;
  return (
    <section className={cx("os-counter", empty && "is-empty")} aria-label="Relationship counter">
      {empty ? (
        <>
          <Icon name="calendar" size={28} />
          <p className="card-title">Set your start date</p>
          <p className="caption">Add the date in Settings and the counter will appear. The CMS never guesses it.</p>
        </>
      ) : (
        <>
          <p className="os-counter__n display">{Number(days).toLocaleString("en-US")}</p>
          <p className="os-counter__u overline">days together</p>
          <p className="os-counter__s caption">{since}{next ? " · " + next : ""}</p>
          {sample && <span className="os-counter__sample caption">Sample value</span>}
        </>
      )}
    </section>
  );
}

/* ---------- Timeline ---------- */
function TimelineMilestone({ date, title, teaser, tone = 1, last, first, index, href, cover, photos }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <li ref={ref} className={cx("os-tl", seen && "is-seen", last && "is-last", first && "is-first")}>
      <span className="os-tl__rail" aria-hidden="true"><span className="os-tl__dot" /></span>
      <div className="os-tl__body">
        <p className="overline">{date}</p>
        <h3 className="card-title">{href ? <Link href={href} className="os-tl__link">{title}</Link> : title}</h3>
        <div className="os-tl__card">
          {photos?.length ? <PhotoCarousel photos={photos} label={`${title} photos`} /> : <Photo tone={tone} aspect="4 / 3" rounded="md" src={cover} alt="" label={cover ? "" : "Sample photo"} />}
          <p className="os-tl__teaser">{teaser}</p>
          <span className="os-tl__more label">Read chapter<Icon name="chevron-right" size={18} /></span>
        </div>
      </div>
    </li>
  );
}

/* ---------- Letterbox card ---------- */
const NOTE_KIND = { note: "Short note", letter: "Long letter", "open-when": "Open when…", voice: "Voice letter", special: "Special delivery" };
const NOTE_STATE = {
  unlocked: { icon: "envelope", text: "Ready to open" },
  opened: { icon: "check", text: "Opened" },
  locked: { icon: "lock", text: "Locked" },
  scheduled: { icon: "calendar", text: "Arrives" },
  pin: { icon: "lock", text: "Needs a clue" },
};
function LetterCard({ kind = "note", state = "unlocked", title, teaser, when, tone }) {
  const st = NOTE_STATE[state];
  const sealed = state === "locked" || state === "scheduled" || state === "pin";
  return (
    <article className={cx("os-lcard", "is-" + state)} data-kind={kind}>
      <svg className="os-lcard__flap" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0h100L50 28z" /></svg>
      <span className="os-lcard__seal" aria-hidden="true"><Icon name={kind === "voice" ? "wave" : sealed ? "lock" : "heart"} size={16} filled={!sealed && kind !== "voice"} /></span>
      <p className="overline">{NOTE_KIND[kind]}</p>
      <h3 className="card-title">{title}</h3>
      <p className="os-lcard__teaser">{teaser}</p>
      <p className="os-lcard__state label"><Icon name={st.icon} size={16} />{st.text}{when ? " " + when : ""}</p>
    </article>
  );
}

/* ---------- Surprise ---------- */
const SUR = {
  locked: { icon: "lock", text: "Locked", cta: null },
  countdown: { icon: "clock", text: "Opens in", cta: null },
  available: { icon: "gift", text: "Ready for you", cta: "Open it" },
  completed: { icon: "check", text: "Opened", cta: "Open again" },
  expired: { icon: "archive", text: "No longer available", cta: null },
};
function SurpriseTile({ state = "locked", title, teaser, countdown, onOpen = undefined, href = undefined }) {
  const s = SUR[state];
  return (
    <article className={cx("os-sur", "is-" + state)}>
      <div className="os-sur__gift" aria-hidden="true">
        <Icon name={state === "available" ? "gift" : s.icon} size={34} />
        {state === "available" && <span className="os-sur__sparkle" />}
      </div>
      <div className="os-sur__body">
        <h3 className="card-title">{title}</h3>
        <p className="os-sur__teaser">{teaser}</p>
        <p className="os-sur__state label"><Icon name={s.icon} size={16} />{s.text}{state === "countdown" && countdown ? " " + countdown : ""}</p>
      </div>
      {s.cta && (href ? <Link href={href} className="os-btn os-btn--primary os-btn--sm"><span>{s.cta}</span></Link> : <Button size="sm" variant={state === "available" ? "primary" : "quiet"} onClick={onOpen}>{s.cta}</Button>)}
    </article>
  );
}

/* ---------- Music + calls ---------- */
function SongCard({ title, artist, dedication, source = "Streaming link", playing, unavailable, featured, progress, tone = 2, onToggle, action, coverUrl, coverPosition }: {
  title: string; artist: string; dedication?: string; source?: string; playing?: boolean; unavailable?: boolean;
  featured?: boolean; progress?: number; tone?: number; onToggle?: () => void; action?: React.ReactNode;
  coverUrl?: string; coverPosition?: string;
}) {
  return (
    <article className={cx("os-song", featured && "is-featured", playing && "is-playing", unavailable && "is-unavailable")}>
      {coverUrl ? <img className="os-song__cover" src={coverUrl} alt={`${title} cover`} style={{ objectPosition: coverPosition }} /> : <div className="os-song__disc" data-tone={tone} aria-hidden="true"><span className="os-song__hole" /></div>}
      <div className="os-song__body">
        {featured && <p className="overline">Our song</p>}
        <h3 className="card-title">{title}</h3>
        <p className="os-song__artist caption">{artist} · {source}</p>
        {dedication && <p className="os-song__ded hand">{dedication}</p>}
        {unavailable && <p className="os-song__warn caption"><Icon name="alert" size={16} />Playback isn't available here. Open it in the source app.</p>}
        {progress != null && <div className="os-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress * 100)} aria-label="Song progress"><span style={{ width: progress * 100 + "%" }} /></div>}
      </div>
      {action !== undefined ? action : onToggle && <Button iconOnly variant={unavailable ? "quiet" : "primary"} icon={unavailable ? "external" : playing ? "pause" : "play"} label={unavailable ? "Open in source app" : playing ? "Pause " + title : "Play " + title} onClick={onToggle} />}
    </article>
  );
}

function MiniPlayer({ title, artist, playing, progress = 0.4, tone = 2, onToggle, floating }) {
  return (
    <div className={cx("os-mini", playing && "is-playing", floating && "is-floating")} role="group" aria-label="Now playing">
      <div className="os-mini__disc os-song__disc" data-tone={tone} aria-hidden="true"><span className="os-song__hole" /></div>
      <div className="os-mini__txt"><strong className="label">{title}</strong><span className="caption">{artist}</span></div>
      <Button iconOnly size="sm" variant="ghost" icon={playing ? "pause" : "play"} label={playing ? "Pause" : "Play"} onClick={onToggle} />
      <Button iconOnly size="sm" variant="ghost" icon="x" label="Stop and close player" />
      <div className="os-mini__bar" aria-hidden="true"><span style={{ width: progress * 100 + "%" }} /></div>
    </div>
  );
}

function CallCard({ title, date, duration, description, playing, hasAudio, featured, sample }) {
  return (
    <article className={cx("os-call", featured && "is-featured", playing && "is-playing")}>
      <header>
        <div>
          {featured && <p className="overline">Longest call</p>}
          <h3 className="card-title">{title}</h3>
          <p className="caption">{date}</p>
        </div>
        <p className="os-call__dur"><Icon name="clock" size={16} /><span>{duration}</span></p>
      </header>
      {description && <p className="os-call__desc">{description}</p>}
      {hasAudio ? (
        <div className="os-call__audio">
          <Button iconOnly size="sm" icon={playing ? "pause" : "play"} label={playing ? "Pause recording" : "Play recording"} />
          <span className="os-wave" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ "--i": i, "--h": 30 + ((i * 37) % 60) + "%" }} />)}</span>
        </div>
      ) : (
        <p className="caption os-call__noaudio">No recording attached</p>
      )}
      {sample && <p className="caption os-call__sample">Sample call record</p>}
    </article>
  );
}

/* ---------- Navigation ---------- */
function TopBar({ title, overline, back, wordmark, trailing }) {
  return (
    <header className="os-top">
      {back ? <Button iconOnly variant="ghost" icon="chevron-left" label="Back" /> : <span className="os-top__sp" />}
      <div className="os-top__mid">
        {wordmark ? <Wordmark /> : (<>{overline && <p className="overline">{overline}</p>}<h1 className="os-top__title card-title">{title}</h1></>)}
      </div>
      {trailing || <span className="os-top__sp" />}
    </header>
  );
}
const TABS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "story", label: "Story", icon: "book" },
  { id: "photos", label: "Photos", icon: "image" },
  { id: "music", label: "Our Songs", icon: "music" },
  { id: "more", label: "More", icon: "more" },
];
function TabBar({ items = TABS, active = "home", onSelect }) {
  return (
    <nav className="os-tabs" aria-label="Primary">
      {items.slice(0, 5).map((t) => (
        <button key={t.id} type="button" className={cx("os-tab", active === t.id && "is-active")} aria-current={active === t.id ? "page" : undefined} onClick={() => onSelect && onSelect(t.id)}>
          <Icon name={t.icon} size={24} filled={active === t.id && t.icon === "heart"} />
          <span className="os-tab__l">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ---------- Feedback ---------- */
const ST = {
  draft: { cls: "warn", icon: "sliders", text: "Draft" },
  scheduled: { cls: "info", icon: "calendar", text: "Scheduled" },
  published: { cls: "ok", icon: "check", text: "Published" },
  archived: { cls: "neutral", icon: "archive", text: "Archived" },
  failed: { cls: "danger", icon: "alert", text: "Failed" },
  locked: { cls: "neutral", icon: "lock", text: "Locked" },
  processing: { cls: "info", icon: "refresh", text: "Processing" },
};
function StatusBadge({ status = "draft", detail }) {
  const s = ST[status];
  return <span className={cx("os-badge", "os-badge--" + s.cls)}><Icon name={s.icon} size={14} />{s.text}{detail ? " · " + detail : ""}</span>;
}

function Toast({ tone = "ok", children, action }) {
  return (
    <div className={cx("os-toast", "os-toast--" + tone)} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={tone === "danger" ? "alert" : tone === "info" ? "wifi" : "check"} size={20} />
      <span>{children}</span>
      {action && <button type="button" className="os-toast__act label">{action}</button>}
    </div>
  );
}

function EmptyState({ icon = "envelope", title, body, action }) {
  return (
    <div className="os-empty">
      <div className="os-empty__art" aria-hidden="true"><span className="os-empty__ring" /><Icon name={icon} size={36} /></div>
      <h3 className="card-title">{title}</h3>
      <p className="os-empty__body">{body}</p>
      {action}
    </div>
  );
}

function Skeleton({ kind = "card" }) {
  if (kind === "line") return <span className="os-skel os-skel--line" />;
  return (
    <div className="os-skelcard" aria-hidden="true">
      <span className="os-skel" style={{ aspectRatio: "4 / 3" }} />
      <span className="os-skel os-skel--line" style={{ width: "60%" }} />
      <span className="os-skel os-skel--line" />
    </div>
  );
}

function ConfirmDialog({ title, children, confirm = "Delete", cancel = "Keep it", danger = true }) {
  const id = useId();
  return (
    <div className="os-dlg" role="alertdialog" aria-modal="true" aria-labelledby={id}>
      <h3 id={id} className="card-title">{title}</h3>
      <div className="os-dlg__body">{children}</div>
      <div className="os-dlg__actions"><Button variant="quiet">{cancel}</Button><Button variant={danger ? "danger" : "primary"}>{confirm}</Button></div>
    </div>
  );
}

/* ---------- CMS ---------- */
function MediaTile({ tone = 1, title, status = "published", selected, used = 0, state, kind = "image" }) {
  return (
    <figure className={cx("os-media", selected && "is-selected", state && "is-" + state)}>
      <Photo tone={tone} aspect="1 / 1" rounded="sm" label={kind === "audio" ? "Audio" : "Sample"} />
      <span className="os-media__check" aria-hidden="true">{selected && <Icon name="check" size={16} />}</span>
      {state === "processing" && <span className="os-media__ov"><Icon name="refresh" size={20} />Processing</span>}
      {state === "failed" && <span className="os-media__ov"><Icon name="alert" size={20} />Failed</span>}
      <figcaption>
        <span className="label os-media__t">{title}</span>
        <span className="os-media__m"><StatusBadge status={status} />{used > 0 && <span className="caption">Used {used}×</span>}</span>
      </figcaption>
    </figure>
  );
}

function UploadRow({ name, size, progress = 0, state = "uploading", error }) {
  const pct = Math.round(progress * 100);
  return (
    <li className={cx("os-up", "is-" + state)}>
      <Icon name={state === "done" ? "check" : state === "failed" ? "alert" : "upload"} size={22} />
      <div className="os-up__mid">
        <p className="label os-up__n">{name}<span className="caption"> · {size}</span></p>
        {state === "uploading" && <div className="os-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct} aria-label={"Uploading " + name}><span style={{ width: pct + "%" }} /></div>}
        <p className="caption os-up__s">{state === "uploading" ? pct + "% uploaded" : state === "done" ? "Uploaded. Not published yet." : state === "failed" ? error : "Waiting in queue"}</p>
      </div>
      {state === "failed" ? <Button size="sm" variant="quiet" icon="refresh">Retry</Button> : state !== "done" && <Button iconOnly size="sm" variant="ghost" icon="x" label={"Cancel " + name} />}
    </li>
  );
}

function SectionRow({ title, type, icon = "layers", hidden, selected, window: win }) {
  return (
    <li className={cx("os-sec", hidden && "is-hidden", selected && "is-selected")}>
      <button type="button" className="os-sec__drag" aria-label={"Reorder " + title + ". Use arrow keys to move."}><Icon name="drag" size={22} /></button>
      <Icon name={icon} size={22} className="os-sec__ico" />
      <div className="os-sec__mid"><p className="label">{title}</p><p className="caption">{type}{hidden ? " · Hidden from her" : ""}{win ? " · " + win : ""}</p></div>
      <div className="os-sec__act">
        <Button iconOnly size="sm" variant="ghost" icon={hidden ? "eye-off" : "eye"} label={(hidden ? "Show " : "Hide ") + title} />
        <Button iconOnly size="sm" variant="ghost" icon="sliders" label={"Edit " + title} />
        <Button iconOnly size="sm" variant="ghost" icon="copy" label={"Duplicate " + title} />
        <Button iconOnly size="sm" variant="ghost" icon="trash" label={"Delete " + title} />
      </div>
    </li>
  );
}

const ADMIN = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "media", label: "Media Library", icon: "image" },
  { id: "albums", label: "Albums", icon: "layers" },
  { id: "story", label: "Our Story", icon: "book" },
  { id: "songs", label: "Songs & Playlists", icon: "music" },
  { id: "calls", label: "Calls", icon: "phone" },
  { id: "notes", label: "Notes", icon: "envelope" },
  { id: "surprises", label: "Surprises", icon: "gift" },
  { id: "pages", label: "Pages & Builder", icon: "sliders" },
  { id: "themes", label: "Themes", icon: "palette" },
  { id: "users", label: "Accounts", icon: "users" },
  { id: "revisions", label: "Revisions & Audit", icon: "history" },
];
function AdminSidebar({ items = ADMIN, active = "overview", badge = {} }) {
  return (
    <aside className="os-side">
      <div className="os-side__brand"><Wordmark size="md" /><span className="caption">Admin</span></div>
      <nav aria-label="Admin">
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <a href="#" onClick={(e) => e.preventDefault()} className={cx("os-side__a", active === i.id && "is-active")} aria-current={active === i.id ? "page" : undefined}>
                <Icon name={i.icon} size={20} /><span>{i.label}</span>{badge[i.id] != null && <span className="os-side__n">{badge[i.id]}</span>}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function RevisionItem({ n, who, when, status = "published", current, note }) {
  return (
    <li className={cx("os-rev", current && "is-current")}>
      <span className="os-rev__dot" aria-hidden="true" />
      <div>
        <p className="label">Version {n} <StatusBadge status={status} /></p>
        <p className="caption">{who} · {when}{note ? " · " + note : ""}</p>
        {!current && <Button size="sm" variant="quiet" icon="history">Restore this version</Button>}
        {current && <p className="caption os-rev__cur">Current version</p>}
      </div>
    </li>
  );
}

function ThemeSwatch({ id, name, selected }) {
  return (
    <button type="button" className={cx("os-theme", selected && "is-selected")} aria-pressed={!!selected} data-theme={id}>
      <span className="os-theme__chips" aria-hidden="true"><i style={{ background: "var(--canvas)" }} /><i style={{ background: "var(--surface-tint)" }} /><i style={{ background: "var(--petal)" }} /><i style={{ background: "var(--accent)" }} /><i style={{ background: "var(--ink)" }} /></span>
      <span className="label os-theme__n">{name}{selected && <Icon name="check" size={16} />}</span>
    </button>
  );
}

export { Icon, Wordmark, Button, HeartButton, Chip, Toggle, TextField, Photo, Polaroid, WaxSeal, Envelope, Letter, RelationshipCounter, TimelineMilestone, LetterCard, SurpriseTile, SongCard, MiniPlayer, CallCard, TopBar, TabBar, StatusBadge, Toast, EmptyState, Skeleton, ConfirmDialog, MediaTile, UploadRow, SectionRow, AdminSidebar, RevisionItem, ThemeSwatch };
