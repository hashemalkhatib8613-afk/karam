"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ENTITIES, STATUS_OPTIONS } from "@/lib/entities";
import { localToIso } from "@/lib/dates";
import { isUuid, slugify, popNicknames } from "@/lib/text";
import { assetUsage } from "@/lib/usage";
import { createServiceClient } from "@/lib/supabase/admin";
import type { FormState } from "./auth";
import { containsEmailAddress, isLoginMethod } from "@/lib/login-method";

/** Every action re-checks the admin role on the server. The database enforces it again through RLS. */
async function ctx() {
  const v = await requireAdmin();
  const { data } = await v.supabase.from("site_settings").select("timezone").eq("id", 1).maybeSingle();
  return { ...v, tz: (data?.timezone as string) || "UTC" };
}
async function audit(supabase: any, action: string, type: string, id: string, meta: any = {}) {
  await supabase.rpc("write_audit", { p_action: action, p_entity_type: type, p_entity_id: id, p_meta: meta });
}
const refresh = () => revalidatePath("/", "layout");

/* ------------------------------------------------------------------ entities */
export async function saveEntity(_prev: FormState, fd: FormData): Promise<FormState> {
  const key = String(fd.get("_entity") ?? "");
  const id = String(fd.get("_id") ?? "new");
  const ent = ENTITIES[key];
  if (!ent) return { error: "Unknown content type." };
  const { supabase, tz } = await ctx();

  const row: Record<string, any> = {};
  for (const f of ent.fields) {
    const raw = fd.get(f.name);
    const s = typeof raw === "string" ? raw.trim() : "";
    switch (f.type) {
      case "text": row[f.name] = s.slice(0, 300); break;
      case "textarea": row[f.name] = (typeof raw === "string" ? raw : "").slice(0, 30000); break;
      case "slug": row[f.name] = slugify(s || String(fd.get(ent.slugFrom ?? "title") ?? "")); break;
      case "date": row[f.name] = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; break;
      case "datetime": row[f.name] = localToIso(s, tz); break;
      case "select": {
        if (!f.options!.some(([v]) => v === s)) return { error: `Choose a value for “${f.label}”.` };
        row[f.name] = s; break;
      }
      case "checkbox": row[f.name] = raw === "on"; break;
      case "media":
      case "song":
      case "note":
      case "album": row[f.name] = isUuid(s) ? s : null; break;
      case "url":
        if (s && !/^https:\/\/[^\s]+$/i.test(s)) return { error: `“${f.label}” must be a link starting with https://` };
        row[f.name] = s || null; break;
      case "number": row[f.name] = Number.isFinite(parseInt(s, 10)) ? parseInt(s, 10) : 0; break;
    }
    if (f.required && !row[f.name]) return { error: `“${f.label}” is required.` };
    if (f.type === "slug" && !row[f.name]) return { error: "Add a title so a web address can be created." };
  }

  const status = String(fd.get("status") ?? "draft");
  if (!STATUS_OPTIONS.some(([v]) => v === status)) return { error: "Choose a status." };
  const scheduledAt = localToIso(String(fd.get("scheduled_at") ?? ""), tz);
  if (status === "scheduled" && !scheduledAt) return { error: "Pick the date and time it should go live." };
  row.status = status;
  row.scheduled_at = status === "scheduled" ? scheduledAt : null;

  if (ent.key === "surprises" && row.unlock_at && row.expires_at && Date.parse(row.expires_at) <= Date.parse(row.unlock_at)) {
    return { error: "The expiry time must be after the unlock time." };
  }

  let prevStatus: string | null = null;
  if (id !== "new") {
    if (!isUuid(id)) return { error: "Bad id." };
    const columns = ent.tracksPublishedAt === false ? "status" : "status,published_at";
    const { data } = await supabase.from(ent.table).select(columns).eq("id", id).maybeSingle();
    prevStatus = data?.status ?? null;
    if (ent.tracksPublishedAt !== false && status === "published" && !data?.published_at) row.published_at = new Date().toISOString();
  } else if (ent.tracksPublishedAt !== false && status === "published") row.published_at = new Date().toISOString();

  const res =
    id === "new"
      ? await supabase.from(ent.table).insert(row).select("id").single()
      : await supabase.from(ent.table).update(row).eq("id", id).select("id").single();
  if (res.error) return { error: res.error.code === "23505" ? "That web address is already used. Change it." : `Couldn't save: ${res.error.message}` };

  const rid = res.data.id as string;
  if (status !== prevStatus) await audit(supabase, `${ent.singular}.${status}`, ent.table, rid, { title: row.title });
  refresh();
  redirect(`/admin/${key}/${rid}?saved=1`);
}

export async function deleteEntity(fd: FormData) {
  const key = String(fd.get("_entity") ?? "");
  const id = String(fd.get("_id") ?? "");
  const ent = ENTITIES[key];
  if (!ent || !isUuid(id)) return;
  const { supabase } = await ctx();
  await supabase.from(ent.table).delete().eq("id", id);
  await audit(supabase, `${ent.singular}.deleted`, ent.table, id);
  refresh();
  redirect(`/admin/${key}`);
}

/* ------------------------------------------------------------------ attached media (album photos, chapter photos) */
async function joinOf(fd: FormData) {
  const ent = ENTITIES[String(fd.get("_entity") ?? "")];
  const id = String(fd.get("_id") ?? "");
  if (!ent?.join || !isUuid(id)) throw new Error("bad request");
  const c = await ctx();
  return { ...c, ent, join: ent.join, id };
}
async function renumber(supabase: any, join: any, id: string, ordered: string[]) {
  await Promise.all(ordered.map((mid, i) => supabase.from(join.table).update({ sort_order: i }).eq(join.fk, id).eq("media_id", mid)));
}

export async function attachMedia(fd: FormData) {
  const { supabase, ent, join, id } = await joinOf(fd);
  const ids = String(fd.get("media_ids") ?? "").split(",").filter(isUuid);
  if (ids.length) {
    const { data } = await supabase.from(join.table).select("media_id,sort_order").eq(join.fk, id).order("sort_order");
    const have = new Set((data ?? []).map((r: any) => r.media_id));
    let n = (data ?? []).length;
    const rows = ids.filter((m) => !have.has(m)).map((m) => ({ [join.fk]: id, media_id: m, sort_order: n++ }));
    if (rows.length) await supabase.from(join.table).insert(rows);
  }
  refresh();
  redirect(`/admin/${ent.key}/${id}?saved=1`);
}
export async function detachMedia(fd: FormData) {
  const { supabase, ent, join, id } = await joinOf(fd);
  const mid = String(fd.get("media_id") ?? "");
  if (isUuid(mid)) await supabase.from(join.table).delete().eq(join.fk, id).eq("media_id", mid);
  refresh();
  redirect(`/admin/${ent.key}/${id}`);
}
export async function moveMedia(fd: FormData) {
  const { supabase, ent, join, id } = await joinOf(fd);
  const mid = String(fd.get("media_id") ?? "");
  const dir = fd.get("dir") === "up" ? -1 : 1;
  const { data } = await supabase.from(join.table).select("media_id").eq(join.fk, id).order("sort_order");
  const order = (data ?? []).map((r: any) => r.media_id as string);
  const i = order.indexOf(mid);
  const j = i + dir;
  if (i >= 0 && j >= 0 && j < order.length) {
    [order[i], order[j]] = [order[j], order[i]];
    await renumber(supabase, join, id, order);
  }
  refresh();
  redirect(`/admin/${ent.key}/${id}`);
}

/* ------------------------------------------------------------------ media library */
export async function registerAsset(input: {
  path: string; thumbPath?: string | null; originalPath?: string | null; mime: string; size: number;
  width?: number | null; height?: number | null; duration?: number | null; title: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase } = await ctx();
  const okPath = (p?: string | null) => !p || /^uploads\/[a-z0-9][a-z0-9/_.-]{3,200}$/.test(p);
  if (!okPath(input.path) || !okPath(input.thumbPath) || !okPath(input.originalPath) || !input.path) return { ok: false, error: "Bad file path." };
  const kind = input.mime.startsWith("audio/") ? "audio" : input.mime.startsWith("image/") ? "image"
    : ["video/mp4", "video/webm", "video/quicktime"].includes(input.mime) ? "video" : null;
  if (!kind) return { ok: false, error: "Unsupported file type." };
  const { data, error } = await supabase.from("media_assets").insert({
    storage_path: input.path, thumb_path: input.thumbPath ?? null, original_path: input.originalPath ?? null, kind, mime_type: input.mime,
    file_size: Math.max(0, Math.floor(input.size)), width: input.width ?? null, height: input.height ?? null,
    duration_seconds: input.duration ?? null, title: input.title.slice(0, 200),
  }).select("id").single();
  if (error) return { ok: false, error: error.message };
  await audit(supabase, "media.uploaded", "media_assets", data.id, { path: input.path });
  refresh();
  return { ok: true, id: data.id };
}

export async function updateAsset(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return { error: "Bad id." };
  const { supabase } = await ctx();
  const num = (k: string) => Math.min(100, Math.max(0, Number(fd.get(k)) || 50));
  const taken = String(fd.get("taken_at") ?? "");
  const { error } = await supabase.from("media_assets").update({
    title: String(fd.get("title") ?? "").slice(0, 200), caption: String(fd.get("caption") ?? "").slice(0, 1000),
    alt_text: String(fd.get("alt_text") ?? "").slice(0, 500), location_text: String(fd.get("location_text") ?? "").slice(0, 200),
    taken_at: /^\d{4}-\d{2}-\d{2}$/.test(taken) ? taken : null,
    tags: String(fd.get("tags") ?? "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 20),
    focal_x: num("focal_x"), focal_y: num("focal_y"),
  }).eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return { ok: "Saved." };
}

export async function deleteAsset(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  if (!isUuid(id)) return;
  const { supabase } = await ctx();
  if ((await assetUsage(supabase, id)).length) redirect(`/admin/media/${id}?blocked=1`);
  const { data: a } = await supabase.from("media_assets").select("storage_path,thumb_path,original_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (error) redirect(`/admin/media/${id}?blocked=1`);
  const paths = [a?.storage_path, a?.thumb_path, a?.original_path].filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from("media").remove(paths);
  await audit(supabase, "media.deleted", "media_assets", id, { paths });
  refresh();
  redirect("/admin/media");
}

/* ------------------------------------------------------------------ settings, notes, users */
const THEMES = ["soft-romantic", "midnight-love", "vintage-memories", "modern-minimal"];
const SECTION_KEYS = ["hero", "counter", "song", "note", "album", "chapter"];

export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const t = (k: string, max = 400) => String(fd.get(k) ?? "").slice(0, max).trim();
  const tz = t("timezone", 60) || "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); } catch { return { error: "That timezone isn't recognised. Use a name like Asia/Amman or Europe/London." }; }
  const theme = t("theme", 40);
  if (!THEMES.includes(theme)) return { error: "Choose a theme." };
  const method = t("login_method", 20);
  if (!isLoginMethod(method)) return { error: "Choose a login method." };
  const loginHeadline = t("login_headline");
  if (containsEmailAddress(loginHeadline)) return { error: "The public sign-in headline cannot contain an email address." };
  if (method === "date") {
    const { data, error } = await supabase.rpc("date_login_status");
    const status = Array.isArray(data) ? data[0] : data;
    if (error || !status?.is_enabled || !status?.has_date || !status?.target_user) {
      return { error: "Save and enable a secret date in Accounts before choosing Our date." };
    }
  }
  if (method === "username") {
    const { data, error } = await supabase.from("profiles").select("id").eq("role", "partner").not("username", "is", null).limit(1);
    if (error || !data?.length) return { error: "Set her username in Accounts before choosing Username and password." };
  }
  const nicknames = popNicknames(fd.get("pop_nicknames"));
  if (nicknames.length > 30 || nicknames.some((name) => name.length > 50)) {
    return { error: "Add up to 30 pop nicknames, with no more than 50 characters each." };
  }
  const start = t("relationship_start_date", 10);
  const hero = t("hero_asset_id", 50);
  const floatingIconsLayer = fd.get("floating_icons_layer") === "foreground" ? "foreground" : "background";
  const requestedQuantity = t("floating_icons_quantity", 10);
  const floatingIconsQuantity = ["min", "medium", "max"].includes(requestedQuantity) ? requestedQuantity : "medium";
  const requestedHintStep = t("welcome_pop_hint_show_on", 20);
  const welcomePopHintShowOn = ["arrival", "envelope_open", "letter_open"].includes(requestedHintStep) ? requestedHintStep : "envelope_open";
  const welcomePopHintFrequency = fd.get("welcome_pop_hint_frequency") === "every_visit" ? "every_visit" : "once";
  const requestedHintDelay = Number(fd.get("welcome_pop_hint_delay_seconds"));
  const welcomePopHintDelay = Number.isInteger(requestedHintDelay) ? Math.min(30, Math.max(0, requestedHintDelay)) : 1;
  const sections = SECTION_KEYS.map((k) => ({ key: k, on: fd.get(`sec_${k}`) === "on", ord: Number(fd.get(`ord_${k}`)) || 0 })).sort((a, b) => a.ord - b.ord).map(({ key, on }) => ({ key, on }));
  const { data: cur, error: readError } = await supabase.from("site_settings").select("welcome_version,welcome_pop_hint_version,feature_flags").eq("id", 1).single();
  if (readError || !cur) return { error: readError?.message?.includes("welcome_pop_hint")
    ? "Run the 0012_welcome_pop_hint.sql database migration, then save settings again."
    : "Couldn't load the current settings. Please refresh and try again." };
  const patch: any = {
    pop_nicknames: nicknames,
    shared_display_name: t("shared_display_name", 80) || "session",
    site_name: t("site_name", 60) || "Just Us.", tagline: t("tagline"), greeting: t("greeting"), login_headline: loginHeadline, login_subtitle: t("login_subtitle"), login_method: method,
    home_headline: t("home_headline"), home_subtitle: t("home_subtitle"), welcome_letter: String(fd.get("welcome_letter") ?? "").slice(0, 8000), welcome_signature: t("welcome_signature", 80),
    relationship_start_date: /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null, timezone: tz, theme, motion: fd.get("motion") === "reduced" ? "reduced" : "full",
    floating_icons_layer: floatingIconsLayer, floating_icons_quantity: floatingIconsQuantity,
    welcome_pop_hint_enabled: fd.get("welcome_pop_hint_enabled") === "on",
    welcome_pop_hint_show_on: welcomePopHintShowOn,
    welcome_pop_hint_frequency: welcomePopHintFrequency,
    welcome_pop_hint_delay_seconds: welcomePopHintDelay,
    welcome_pop_hint_prompt: t("welcome_pop_hint_prompt", 160) || "Psst… catch me before I disappear.",
    welcome_pop_hint_success: t("welcome_pop_hint_success", 200) || "The little things here carry little surprises ♡",
    hero_asset_id: isUuid(hero) ? hero : null, home_sections: sections,
    feature_flags: {
      ...cur.feature_flags,
      polaroid: fd.get("ff_polaroid") === "on",
      replies: fd.get("ff_replies") === "on",
      bucket_list: fd.get("ff_bucket_list") === "on",
      downloads: fd.get("ff_downloads") === "on",
    },
  };
  if (fd.get("replay_welcome") === "on") patch.welcome_version = (cur?.welcome_version ?? 1) + 1;
  if (fd.get("replay_welcome_pop_hint") === "on") patch.welcome_pop_hint_version = (cur?.welcome_pop_hint_version ?? 1) + 1;
  const { error } = await supabase.from("site_settings").update(patch).eq("id", 1).select("id").single();
  if (error) return { error: error.message?.includes("welcome_pop_hint")
    ? "Run the 0012_welcome_pop_hint.sql database migration, then save settings again."
    : error.message?.includes("floating_icons_")
    ? "Run the 0009_floating_icon_controls.sql database migration, then save settings again."
    : error.message?.includes("pop_nicknames")
    ? "Run the 0008_pop_nicknames.sql database migration, then save settings again."
    : error.message };
  await audit(supabase, "settings.saved", "site_settings", "1", { theme, login_method: method });
  refresh();
  return { ok: "Settings saved." };
}

export async function saveNoteClue(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("note_id") ?? "");
  if (!isUuid(id)) return { error: "Bad id." };
  const { supabase } = await ctx();
  if (fd.get("clear") === "1") {
    await supabase.rpc("clear_note_clue", { p_note: id });
    refresh();
    return { ok: "Clue removed. The note opens without a question." };
  }
  const clue = String(fd.get("clue") ?? "").trim().slice(0, 300);
  const answer = String(fd.get("answer") ?? "").trim().slice(0, 200);
  if (!clue || !answer) return { error: "Add both the question and the answer." };
  const { error } = await supabase.rpc("set_note_clue", { p_note: id, p_clue: clue, p_answer: answer });
  if (error) return { error: error.message };
  refresh();
  return { ok: "Clue saved. The answer is stored hashed and can't be read back." };
}

export async function inviteUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const name = String(fd.get("display_name") ?? "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  try {
    const svc = createServiceClient();
    const { error } = await svc.auth.admin.inviteUserByEmail(email, { data: { display_name: name }, redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm?next=/auth/set-password` });
    if (error) return { error: `Couldn't send the invitation: ${error.message}` };
  } catch (e: any) {
    return { error: e?.message?.includes("SERVICE_ROLE") ? "SUPABASE_SERVICE_ROLE_KEY is not set on the server." : "Couldn't send the invitation." };
  }
  await audit(supabase, "user.invited", "auth.users", email);
  revalidatePath("/admin/users");
  return { ok: `Invitation sent to ${email}.` };
}

export async function resetWelcome(fd: FormData) {
  const id = String(fd.get("user_id") ?? "");
  if (!isUuid(id)) return;
  const { supabase } = await ctx();
  await supabase.rpc("reset_onboarding", { p_user: id });
  await audit(supabase, "user.welcome_reset", "profiles", id);
  revalidatePath("/admin/users");
}

/* ------------------------------------------------------------------ sign-in options: usernames and the secret date */
export async function setUsername(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("user_id") ?? "");
  if (!isUuid(id)) return { error: "Bad id." };
  const { supabase } = await ctx();
  const name = String(fd.get("username") ?? "").trim().toLowerCase();
  if (name && !/^[a-z0-9._-]{3,30}$/.test(name)) return { error: "Use 3 to 30 lowercase letters, numbers, dots, dashes or underscores." };
  if (!name) {
    const { data: settings } = await supabase.from("site_settings").select("login_method").eq("id", 1).single();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
    if (settings?.login_method === "username" && profile?.role === "partner") return { error: "Choose another login method in Site settings before removing her username." };
  }
  const { error } = await supabase.from("profiles").update({ username: name || null }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "That username is already taken." : "Couldn't save the username." };
  await audit(supabase, "user.username_set", "profiles", id, { username: name || null });
  revalidatePath("/admin/users");
  return { ok: name ? "Username saved." : "Username removed." };
}

export async function saveDateLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const user = String(fd.get("user_id") ?? "");
  const date = String(fd.get("date") ?? "").trim();
  const enabled = fd.get("enabled") === "on";
  if (!enabled) {
    const { data: settings } = await supabase.from("site_settings").select("login_method").eq("id", 1).single();
    if (settings?.login_method === "date") return { error: "Choose another login method in Site settings before disabling date sign-in." };
  }
  if (!isUuid(user)) return { error: "Invite her first, then choose her account." };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a valid date." };
  const { error } = await supabase.rpc("set_date_login", { p_user: user, p_date: date || null, p_enabled: enabled });
  if (error) {
    if (error.message.includes("partner_only")) return { error: "The date can only open her account, never an admin account." };
    if (error.message.includes("bad_date") || error.message.includes("date/time")) return { error: "That isn't a real date." };
    return { error: "Couldn't save. Try again." };
  }
  await audit(supabase, "date_login.saved", "date_login", "1", { enabled, changed_date: !!date });
  revalidatePath("/admin/users");
  return { ok: enabled ? "Saved. Signing in with the date is ON." : "Saved. Signing in with the date is OFF." };
}


export async function saveCarousel(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await ctx();
  const lead = String(fd.get("id") ?? "");
  if (!isUuid(lead)) return { error: "Bad image id." };
  const photos = [...new Set(String(fd.get("carousel_photos") ?? "").split(",").filter(isUuid))];
  const { error } = await supabase.rpc("set_carousel_photos", { p_lead: lead, p_photos: photos });
  if (error) return { error: `Couldn't save carousel: ${error.message}` };
  refresh();
  return { ok: "Carousel saved." };
}
