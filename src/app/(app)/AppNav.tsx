"use client";

import { usePathname, useRouter } from "next/navigation";
import { TabBar } from "@/components/ui";

const ROUTES: Record<string, string> = { home: "/", story: "/story", photos: "/gallery", music: "/music", more: "/more" };

export default function AppNav() {
  const path = usePathname();
  const router = useRouter();
  const active = path === "/" ? "home" : path.startsWith("/story") ? "story" : path.startsWith("/gallery") ? "photos" : path.startsWith("/music") ? "music" : "more";
  return <TabBar active={active} onSelect={(id) => router.push(ROUTES[id])} />;
}
