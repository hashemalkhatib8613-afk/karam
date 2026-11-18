import { createClient } from "@/lib/supabase/server";
import { Photo, Wordmark } from "@/components/ui";
import LoginForm from "./LoginForm";
import Link from "next/link";
import { loginMethod, publicLoginHeadline } from "@/lib/login-method";
import FallingBackground from "@/components/FallingBackground";

export const metadata = { title: "Enter" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
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
        <div className="auth-cover" aria-hidden="true">
          <Photo fill tone={1} label="" />
        </div>
        <div style={{ textAlign: "center" }}>
          <Wordmark size="lg" name={(data?.site_name ?? "Just Us.").toLowerCase()} />
        </div>
        <div style={{ textAlign: "center" }}>
          <h1 className="hero" style={{ fontSize: 34 }}>{publicLoginHeadline(data?.login_headline)}</h1>
          <p className="caption" style={{ marginTop: 8, fontSize: 15 }}>{data?.login_subtitle ?? ""}</p>
        </div>
        {sp.error === "link" && <p className="err" role="alert">That link has expired or was already used. Ask for a new one below.</p>}
        <LoginForm key={loginMethod(data?.login_method)} method={loginMethod(data?.login_method)} />
        {loginMethod(data?.login_method) !== "email" && <Link href="/login/admin" className="caption" style={{ textAlign: "center" }}>Admin sign-in</Link>}
      </div>
    </main>
  );
}
