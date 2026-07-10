// This does two things on every matching request:
//   1. Refreshes the Supabase session and writes the updated cookie,
//      so a logged-in trainer doesn't get logged out mid-session.
//   2. If there's no logged-in user AND the page is under /trener,
//      it redirects to /trener/login.
//
// The actual middleware.ts file at the project root (next step) just
// calls updateSession() below. We keep the logic here so that file
// stays tiny.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Start with a response that passes the request straight through.
  // We may modify its cookies (below) or replace it with a redirect.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read the incoming session cookies.
        getAll() {
          return request.cookies.getAll();
        },
        // When Supabase refreshes the session, it hands us new cookies.
        // We write them onto BOTH the request (so anything later in this
        // same request sees the fresh token) and the response (so the
        // browser stores the refreshed token for next time).
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() (not getSession()) — it revalidates the token
  // against the Auth server every time, which is what makes it safe to
  // trust for deciding "is this person really logged in?".
  //
  // Do not put any other code between createServerClient and this call;
  // it can cause hard-to-debug session issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard the /trener area. If the request is for a /trener page and
  // there's no logged-in user, send them to the login page.
  //
  // We explicitly EXEMPT /trener/login itself — otherwise a logged-out
  // visitor to the login page would be redirected to... the login page,
  // over and over (an infinite loop).
  const path = request.nextUrl.pathname;
  const isTrenerArea = path.startsWith("/trener");
  const isLoginPage = path === "/trener/login";

  if (isTrenerArea && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/trener/login";
    return NextResponse.redirect(url);
  }

  // Otherwise return the (possibly cookie-updated) response unchanged.
  // Returning THIS object (not a fresh NextResponse) is important — it's
  // what carries the refreshed session cookie back to the browser.
  return supabaseResponse;
}