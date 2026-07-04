// lib/supabase/server.ts
// Server-side Supabase client.
//
// Use this anywhere code runs ON THE SERVER: Server Components,
// Route Handlers, and Server Actions. (For code that runs in the
// browser, use lib/supabase/client.ts instead.)
//
// It reads the user's session from cookies. The public registration
// page has no logged-in user, so that part is a no-op there — but we
// reuse this same file for the trainer area later, where it matters.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Async because reading cookies is async in Next.js (App Router, v15+).
// Call it like:  const supabase = await createClient();
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Supabase reads the current session from these cookies.
        getAll() {
          return cookieStore.getAll();
        },
        // Supabase writes refreshed session cookies here. In a plain
        // Server Component this can throw — that's safe to ignore,
        // because session refresh gets handled by middleware later.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore.
          }
        },
      },
    }
  );
}