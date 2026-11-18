import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import "@/styles/tokens.css";
import "@/styles/bundle.css";
import "@/styles/app.css";

export const metadata: Metadata = {
  title: { default: "Just Us.", template: "%s · Just Us." },
  description: "Private.",
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=DM+Sans:wght@400;500;600;700&display=swap";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read only public sign-in settings before authentication.
  const supabase = await createClient();
  const { data } = await supabase.from("public_login_settings").select("theme").maybeSingle();
  const theme = data?.theme ?? "soft-romantic";
  return (
    <html lang="en" data-theme={theme}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
