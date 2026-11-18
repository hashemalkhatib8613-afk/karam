"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Icon, Wordmark } from "@/components/ui";
import { signOut } from "@/app/actions/auth";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: "grid", exact: true },
  { href: "/admin/media", label: "Media Library", icon: "image" },
  { href: "/admin/albums", label: "Albums", icon: "layers" },
  { href: "/admin/stories", label: "Our Story", icon: "book" },
  { href: "/admin/songs", label: "Songs", icon: "music" },
  { href: "/admin/notes", label: "Notes", icon: "envelope" },
  { href: "/admin/surprises", label: "Surprises", icon: "gift" },
  { href: "/admin/bucket-list", label: "Bucket list", icon: "heart" },
  { href: "/admin/settings", label: "Site settings", icon: "sliders" },
  { href: "/admin/users", label: "Accounts", icon: "users" },
  { href: "/admin/audit", label: "Activity log", icon: "history" },
];

export default function AdminNav({ label = "Admin", mobile = false }: { label?: string; mobile?: boolean }) {
  const path = usePathname();
  const side = useRef<HTMLElement>(null);
  const closeMobileMenu = () => {
    if (mobile) side.current?.closest("details")?.removeAttribute("open");
  };
  return (
    <aside className="os-side" ref={side}>
      <div className="os-side__brand"><Wordmark size="md" /><span className="caption">Admin</span></div>
      <nav aria-label={label}>
        <ul>
          {ITEMS.map((i) => {
            const active = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
            return (
              <li key={i.href}>
                <Link href={i.href} onClick={closeMobileMenu} className={`os-side__a${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                  <Icon name={i.icon} size={20} /><span>{i.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <ul style={{ marginTop: "auto" }}>
        <li><Link href="/" onClick={closeMobileMenu} className="os-side__a"><Icon name="home" size={20} /><span>View the site</span></Link></li>
        <li>
          <form action={signOut}>
            <button type="submit" className="os-side__a" style={{ width: "100%", background: "none", border: 0, cursor: "pointer", textAlign: "start" }}>
              <Icon name="lock" size={20} /><span>Sign out</span>
            </button>
          </form>
        </li>
      </ul>
    </aside>
  );
}
