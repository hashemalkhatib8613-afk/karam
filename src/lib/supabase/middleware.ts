import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { backendFetch } from "./fetch";

const PUBLIC = ["/login", "/forgot-password", "/auth/", "/api/health"];

/** Refreshes the session cookie when needed and sends anonymous visitors to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: backendFetch },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Fast gate: read the session from the cookie (no network round-trip to the database on every
  // click). It only calls Supabase when the token has expired and needs refreshing. The real,
  // verified check (auth.getUser) happens in getViewer()/requireUser(), and RLS enforces access.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(`${p}/`));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  return response;
}
