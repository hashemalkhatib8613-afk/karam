import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for invite and password-reset emails.
 * The email templates (see SETUP.md) link here with ?token_hash=...&type=invite|recovery.
 * Also accepts ?code=... for the PKCE flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  let next = searchParams.get("next") ?? "/auth/set-password";
  if (!next.startsWith("/") || next.startsWith("//")) next = "/auth/set-password";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  return NextResponse.redirect(`${origin}${ok ? next : "/login?error=link"}`);
}
