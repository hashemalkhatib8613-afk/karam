import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import FallingBackground from "@/components/FallingBackground";
import LoginForm from "../LoginForm";

export const metadata = { title: "Admin sign-in" };

export default async function AdminLoginPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("public_login_settings").select("*").maybeSingle();
  return (
    <main id="main" className="center-page">
      <FallingBackground
        nicknames={data?.pop_nicknames}
        layer={data?.floating_icons_layer}
        quantity={data?.floating_icons_quantity}
      />
      <div className="card auth-card">
        <h1 className="h1">Admin sign-in</h1>
        <p className="caption">Use your admin email and password to manage the site.</p>
        <LoginForm method="email" adminOnly />
        <Link href="/login" className="caption" style={{ textAlign: "center" }}>Back to sign-in</Link>
      </div>
    </main>
  );
}
