/** Timezone-aware helpers. Dates are stored in UTC and shown in the CMS-configured timezone. */

function parts(ms: number, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o: Record<string, number> = {};
  f.formatToParts(new Date(ms)).forEach((p) => {
    if (p.type !== "literal") o[p.type] = Number(p.value);
  });
  return o;
}
function offsetMs(ms: number, tz: string) {
  const p = parts(ms, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** "2026-12-24T18:30" typed in the CMS (wall clock in `tz`) -> ISO UTC string. */
export function localToIso(local: string, tz: string): string | null {
  if (!local) return null;
  const guess = Date.parse(local + ":00Z");
  if (Number.isNaN(guess)) return null;
  let ms = guess - offsetMs(guess, tz);
  ms = guess - offsetMs(ms, tz);
  return new Date(ms).toISOString();
}

/** ISO UTC -> "YYYY-MM-DDTHH:mm" in `tz` for <input type="datetime-local">. */
export function isoToLocal(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const p = parts(Date.parse(iso), tz);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${z(p.month)}-${z(p.day)}T${z(p.hour)}:${z(p.minute)}`;
}

export function todayIn(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}
const utc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days since `start` (YYYY-MM-DD). Day one is the start date itself. */
export function daysTogether(start: string | null | undefined, tz: string): number | null {
  if (!start) return null;
  return Math.max(0, Math.round((utc(todayIn(tz)) - utc(start)) / 86400000)) + 1;
}

export function nextAnniversary(start: string | null | undefined, tz: string): { inDays: number; years: number } | null {
  if (!start) return null;
  const today = todayIn(tz);
  const y = Number(today.slice(0, 4));
  const [sy, sm, sd] = start.split("-").map(Number);
  let target = Date.UTC(y, sm - 1, sd);
  let year = y;
  if (target < utc(today)) {
    year = y + 1;
    target = Date.UTC(year, sm - 1, sd);
  }
  return { inDays: Math.round((target - utc(today)) / 86400000), years: year - sy };
}

export function fmtDate(d: string | null | undefined, tz = "UTC", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  if (!d) return "";
  const date = d.length <= 10 ? new Date(d + "T12:00:00Z") : new Date(d);
  return new Intl.DateTimeFormat("en-GB", { timeZone: d.length <= 10 ? "UTC" : tz, ...opts }).format(date);
}

export function fmtDateTime(iso: string | null | undefined, tz: string) {
  return fmtDate(iso, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
