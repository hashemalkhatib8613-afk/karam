import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  display_name: string;
  role: "admin" | "partner";
  preferences: Record<string, any>;
  onboarding_completed_at: string | null;
  welcome_version: number;
};

/** One lookup per request. Always uses getUser() (verified with Supabase), never an unchecked cookie. */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }, error: authError,
  } = await supabase.auth.getUser();
  if (authError && (authError.status == null || authError.status >= 500)) throw new Error("Sign-in is temporarily unavailable. Please try again.");
  if (!user) return { supabase, user: null, profile: null as Profile | null };
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role, preferences, onboarding_completed_at, welcome_version")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Your profile could not be loaded. Please try again.");
  return { supabase, user, profile: (profile as Profile | null) ?? null };
});

export async function requireUser() {
  const v = await getViewer();
  if (!v.user) redirect("/login");
  return v as typeof v & { user: NonNullable<typeof v.user> };
}

/** Use at the top of every admin page AND every admin server action. */
export async function requireAdmin() {
  const v = await requireUser();
  if (v.profile?.role !== "admin") redirect("/");
  return v;
}

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error || !data) throw new Error("Site settings could not be loaded. Please try again.");
  return data as any;
});
