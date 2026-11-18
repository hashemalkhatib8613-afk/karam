import Link from "next/link";
import { requireUser, getSettings } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";
import { Icon } from "@/components/ui";

export const metadata = { title: "More" };

export default async function MorePage() {
  const { profile } = await requireUser();
  const settings = await getSettings();
  const items = [
    { href: "/notes", label: "Letters to You", icon: "envelope" },
    { href: "/surprises", label: "Surprises", icon: "gift" },
    ...(settings?.feature_flags?.bucket_list ? [{ href: "/bucket-list", label: "Our bucket list", icon: "heart" }] : []),
    { href: "/welcome", label: "Replay our welcome", icon: "heart" },
    { href: "/settings", label: "Settings", icon: "sliders" },
    ...(profile?.role === "admin" ? [{ href: "/admin", label: "Open the CMS", icon: "grid" }] : []),
  ];
  return (
    <>
      <header className="page-head"><p className="overline">More</p><h1 className="h1">Our little world</h1></header>
      <ul className="stack">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="link-card card" style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56, padding: "12px 16px" }}>
              <Icon name={i.icon} size={24} /><span className="label" style={{ fontSize: 16, flex: 1 }}>{i.label}</span><Icon name="chevron-right" size={20} />
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}><button type="submit" className="os-btn os-btn--quiet os-btn--md os-btn--full">Sign out</button></form>
    </>
  );
}
