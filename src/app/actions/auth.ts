"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { loginMethod } from "@/lib/login-method";

export type FormState = { error?: string; ok?: string } | undefined;

const GENERIC = "That doesn't match. Try again, or reset your password.";
const USERNAME = /^[a-z0-9._-]{3,30}$/;

/** Email + password, or username + password. One generic message for every failure so account existence is never revealed. */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("identifier") ?? formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!id || !password) return { error: "Please enter your email or username and your password." };
  const supabase = await createClient();
  const adminOnly = formData.get("admin_only") === "1";
  const method = id.includes("@") ? "email" : "username";
  if (adminOnly) {
    if (method !== "email") return { error: GENERIC };
  } else {
    const { data, error } = await supabase.from("public_login_settings").select("*").maybeSingle();
    if (error) return { error: "Sign-in isn't available right now. Please try again." };
    if (loginMethod(data?.login_method) !== method) return { error: "This sign-in method is no longer active. Reload the page to continue." };
  }

  let email = id;
  if (id.includes("@")) {
    if (!z.string().email().safeParse(id).success) return { error: GENERIC };
  } else {
    if (!USERNAME.test(id)) return { error: GENERIC };
    email = "";
    try {
      const { data } = await createServiceClient().rpc("lookup_login_email", { p_username: id });
      email = typeof data === "string" ? data : "";
    } catch {
      email = "";
    }
    if (!email) return { error: GENERIC };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: GENERIC };
  if (adminOnly) {
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle();
    if (profileError || profile?.role !== "admin") {
      await supabase.auth.signOut();
      return { error: GENERIC };
    }
    redirect("/admin");
  }
  redirect("/");
}

/**
 * Sign in with only the secret date. The date is checked inside the database (hashed, rate limited),
 * it can only ever open the partner account, and the browser never learns which account that is.
 */
export async function signInWithDate(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase.from("public_login_settings").select("*").maybeSingle();
  if (settingsError) return { error: "Sign-in isn't available right now. Please try again." };
  if (loginMethod(settings?.login_method) !== "date") return { error: "This sign-in method is no longer active. Reload the page to continue." };
  const date = String(formData.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the date." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const NO = { error: "That date doesn't open the door." };

  let token: string | undefined;
  try {
    const svc = createServiceClient();
    const { data: userId, error } = await svc.rpc("verify_date_login", { p_date: date, p_ip: ip });
    if (error) {
      if (error.message?.includes("too_many_attempts")) return { error: "Too many tries. Please wait and try again later." };
      return NO;
    }
    if (!userId) return NO;
    const { data: u } = await svc.auth.admin.getUserById(userId as string);
    const email = u?.user?.email;
    if (!email) return NO;
    const { data: link, error: linkError } = await svc.auth.admin.generateLink({ type: "magiclink", email });
    if (linkError) return NO;
    token = link?.properties?.hashed_token;
  } catch {
    return { error: "Date sign-in isn't available right now. Please try again later." };
  }
  if (!token) return NO;

  const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
  if (verifyError) return NO;
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (email.success) {
    const supabase = await createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${site}/auth/confirm?next=/auth/set-password` });
  }
  return { ok: "If that email belongs to an account, a reset link is on its way." };
}

const pw = z.object({ password: z.string().min(10, "Use at least 10 characters.").max(200), confirm: z.string() });

export async function setPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = pw.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.password !== parsed.data.confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "This link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "We couldn't save that password. Try a different one." };
  redirect("/");
}
