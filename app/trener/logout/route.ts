// app/trener/logout/route.ts
// Logout route (lives at /trener/logout).
//
// This is a Route Handler, not a page — it performs an action and then
// redirects, rather than rendering anything. Doing logout on the server
// ensures the session COOKIE is properly cleared (a browser-only logout
// can leave the server briefly still seeing the old cookie).
//
// It handles POST (from the logout button) — using POST rather than a
// plain link means a logout can't be triggered just by loading a URL,
// e.g. from a link in an email or a prefetch.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Clear the Supabase session. Our server client writes the updated
  // (now empty) session cookies as part of this call.
  await supabase.auth.signOut();

  // Send the user to the login page. We build the URL from the current
  // request's origin so it works both locally and once deployed.
  return NextResponse.redirect(new URL("/trener/login", request.url), {
    // 303 tells the browser to follow the redirect with a GET request
    // (the default after a POST would otherwise repeat the POST).
    status: 303,
  });
}