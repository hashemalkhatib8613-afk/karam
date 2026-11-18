import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Used by the keep-alive workflow so the free Supabase project does not pause. Reveals nothing private. */
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("public_login_settings").select("site_name").limit(1);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}
