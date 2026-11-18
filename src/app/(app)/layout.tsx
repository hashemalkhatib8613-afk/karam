import { redirect } from "next/navigation";
import { requireUser, getSettings } from "@/lib/auth";
import AppNav from "./AppNav";
import FallingBackground from "@/components/FallingBackground";
import { PhotoDownloads } from "@/components/PhotoDownloads";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ profile }, settings] = await Promise.all([requireUser(), getSettings()]);
  // First-time partners see the sealed envelope once (stored on their profile, not in the browser).
  const needsWelcome = profile?.role !== "admin" && (!profile?.onboarding_completed_at || (profile?.welcome_version ?? 0) < (settings?.welcome_version ?? 1));
  if (needsWelcome) redirect("/welcome");
  const reduced = profile?.preferences?.reduce_motion || settings?.motion === "reduced";
  return (
    <div className="shell" data-polaroid={settings?.feature_flags?.polaroid !== false ? "on" : "off"} data-motion={reduced ? "reduced" : undefined}>
      <FallingBackground
        reduced={!!reduced}
        nicknames={settings?.pop_nicknames}
        layer={settings?.floating_icons_layer}
        quantity={settings?.floating_icons_quantity}
      />
      <PhotoDownloads enabled={!!settings?.feature_flags?.downloads}>
        <main id="main" className="shell__main">{children}</main>
      </PhotoDownloads>
      <div className="shell__dock"><AppNav /></div>
    </div>
  );
}
