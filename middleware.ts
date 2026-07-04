// middleware.ts  (project root — same level as app/ and package.json)
// This is the file Next.js looks for to run code on incoming requests.
// It just hands each request to our updateSession helper (which
// refreshes the session and guards the /trener area).

import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

// The matcher tells Next.js WHICH requests run the middleware.
// This pattern runs it on all pages EXCEPT static assets and images —
// there's no session to refresh on a favicon or a .png, so we skip
// them for speed.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};