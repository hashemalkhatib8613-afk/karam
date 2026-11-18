import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. It bypasses RLS, so it is used ONLY for auth admin calls
 * (invite / list users) and ONLY after the caller has been verified as an admin.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
