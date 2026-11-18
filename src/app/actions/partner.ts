"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, getSettings } from "@/lib/auth";
import { isUuid } from "@/lib/text";
import type { FormState } from "./auth";

export async function completeOnboarding(next: "/story" | "/") {
  const { supabase } = await requireUser();
  await supabase.rpc("complete_onboarding");
  redirect(next === "/story" ? "/story" : "/");
}

/** Remember the guided pop on the account so the once-only hint stays dismissed across devices. */
export async function completeWelcomePopHint(version: number) {
  const { supabase, profile } = await requireUser();
  const safeVersion = Number.isInteger(version) ? Math.max(1, Math.min(version, 1_000_000)) : 1;
  const preferences = { ...(profile?.preferences ?? {}), welcome_pop_hint_version: safeVersion };
  await supabase.rpc("update_my_profile", {
    p_display_name: profile?.display_name ?? "",
    p_preferences: preferences,
  });
}

const TARGETS = ["media", "chapter", "song", "note", "favorite"] as const;

/** Toggle the single heart reaction. RLS limits rows to the signed-in user. */
export async function toggleReaction(targetType: string, targetId: string): Promise<{ on: boolean }> {
  const { supabase, user } = await requireUser();
  if (!TARGETS.includes(targetType as any) || !isUuid(targetId)) return { on: false };
  const { data: existing } = await supabase
    .from("reactions").select("id").eq("user_id", user.id).eq("target_type", targetType).eq("target_id", targetId).maybeSingle();
  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
    return { on: false };
  }
  const { error } = await supabase.from("reactions").insert({ target_type: targetType, target_id: targetId });
  return { on: !error };
}

export async function myReactions(targetType: string, ids: string[]): Promise<string[]> {
  const { supabase, user } = await requireUser();
  if (!ids.length) return [];
  const { data } = await supabase.from("reactions").select("target_id").eq("user_id", user.id).eq("target_type", targetType).in("target_id", ids);
  return (data ?? []).map((r: any) => r.target_id);
}

export async function unlockNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const answer = String(formData.get("answer") ?? "").slice(0, 200);
  if (!isUuid(id) || !answer.trim()) return { error: "Type your answer first." };
  const { data, error } = await supabase.rpc("unlock_note", { p_note: id, p_answer: answer });
  if (error) return { error: error.message.includes("too_many") ? "Too many tries. Please wait a few minutes." : "Something went wrong. Try again." };
  if (!data) return { error: "Not quite. Try again." };
  revalidatePath(`/notes/${id}`);
  redirect(`/notes/${id}`);
}

export async function replyToNote(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase, user, profile } = await requireUser();
  const settings = await getSettings();
  if (!settings?.feature_flags?.replies || profile?.role !== "partner") return { error: "Replies aren't available right now." };
  const id = String(fd.get("note_id") ?? "");
  const body = String(fd.get("body") ?? "").trim();
  if (!isUuid(id) || !body || body.length > 4000) return { error: "Write a reply of 1 to 4,000 characters." };
  // RLS prevents replies to notes that are still locked or not published.
  const { data: note, error: noteError } = await supabase.from("notes").select("id").eq("id", id).maybeSingle();
  if (noteError || !note) return { error: "Open this letter before replying." };
  const { error } = await supabase.from("note_replies").insert({ note_id: id, author_id: user.id, body });
  if (error) return { error: "Couldn't send your reply. Please try again." };
  revalidatePath(`/notes/${id}`);
  revalidatePath(`/admin/notes/${id}`);
  return { ok: "Your reply was sent." };
}

const profileSchema = z.object({ display_name: z.string().trim().max(80), reduce_motion: z.boolean() });

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, profile } = await requireUser();
  const parsed = profileSchema.safeParse({ display_name: formData.get("display_name") ?? "", reduce_motion: formData.get("reduce_motion") === "on" });
  if (!parsed.success) return { error: "That name is too long." };
  const prefs = { ...(profile?.preferences ?? {}), reduce_motion: parsed.data.reduce_motion };
  const { error } = await supabase.rpc("update_my_profile", { p_display_name: parsed.data.display_name, p_preferences: prefs });
  if (error) return { error: "Couldn't save. Try again." };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
