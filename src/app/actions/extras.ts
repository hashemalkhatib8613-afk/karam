"use server";

import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/text";
import { revalidatePath } from "next/cache";
import type { FormState } from "./auth";

function refreshBucketList() {
  revalidatePath("/bucket-list");
  revalidatePath("/admin/bucket-list");
}

export async function saveExtras(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const { data: settings, error: readError } = await supabase.from("site_settings").select("feature_flags").eq("id", 1).single();
  if (readError || !settings) return { error: "Couldn't load the current extras. Please refresh and try again." };
  const feature_flags = {
    ...settings.feature_flags,
    replies: fd.get("ff_replies") === "on",
    bucket_list: fd.get("ff_bucket_list") === "on",
    downloads: fd.get("ff_downloads") === "on",
  };
  const { error } = await supabase.from("site_settings").update({ feature_flags }).eq("id", 1);
  if (error) return { error: "Couldn't save the extras. Please try again." };
  await supabase.rpc("write_audit", { p_action: "settings.extras_saved", p_entity_type: "site_settings", p_entity_id: "1", p_meta: feature_flags });
  revalidatePath("/", "layout");
  return { ok: "Extras saved." };
}

export async function addBucketItem(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const title = String(fd.get("title") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim();
  const planned = String(fd.get("planned_at") ?? "");
  if (!title || title.length > 200) return { error: "Add a title of up to 200 characters." };
  if (description.length > 2000) return { error: "Keep the details to 2,000 characters." };
  if (planned && (!/^\d{4}-\d{2}-\d{2}$/.test(planned) || !Number.isFinite(Date.parse(planned)))) return { error: "Choose a valid date." };
  const { error } = await supabase.from("bucket_items").insert({ title, description, planned_at: planned || null, status: "published" });
  if (error) return { error: "Couldn't add this dream. Please try again." };
  refreshBucketList();
  return { ok: "Added to our list." };
}

export async function setBucketItemCompleted(_prev: FormState, fd: FormData): Promise<FormState> {
  const { supabase } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const completed = fd.get("completed");
  if (!isUuid(id) || !["true", "false"].includes(String(completed))) return { error: "Choose a valid item." };
  const { data, error } = await supabase.from("bucket_items").update({ completed_at: completed === "true" ? new Date().toISOString() : null })
    .eq("id", id).eq("status", "published").select("id").maybeSingle();
  if (error || !data) return { error: "Couldn't update this dream. Please refresh and try again." };
  refreshBucketList();
  return { ok: completed === "true" ? "Another dream completed together." : "Moved back to still to come." };
}
