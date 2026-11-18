/** Shared site name, independent of the signed-in account. */
export function sharedDisplayName(settings: { shared_display_name?: string | null } | null | undefined) {
  return settings?.shared_display_name?.trim() || "session";
}

/** Replace CMS placeholders in copy, e.g. [HER_NAME]. */
export function fill(text: string, name: string) {
  return (text || "").replaceAll("[HER_NAME]", name || "you");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Plain text with blank lines -> paragraphs. React escapes everything, so there is no HTML injection path. */
export function paragraphs(text: string): string[] {
  return (text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Turns a Spotify or YouTube link into a safe embed URL; anything else returns null. */
export function embedUrl(url: string | null | undefined): { src: string; height: number } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (u.hostname === "open.spotify.com") {
      const m = u.pathname.match(/\/(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
      if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: 152 };
    }
    if (u.hostname === "youtu.be" || u.hostname.endsWith("youtube.com")) {
      const id = u.hostname === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v");
      if (id && /^[\w-]{6,20}$/.test(id)) return { src: `https://www.youtube-nocookie.com/embed/${id}`, height: 220 };
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/** Normalize the nickname list shared by settings and the falling decorations. */
export function popNicknames(value: unknown): string[] {
  const entries = typeof value === "string" ? value.split(/\r?\n/) : Array.isArray(value) ? value : [];
  return [...new Set(entries.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean))];
}
