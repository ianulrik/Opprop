"use server";

// Server Action for the swimmer profile page.
// Runs on the server; can be called from a client component (a button/form).
// Security note: a Server Action is a public endpoint, so we re-check the
// user here. The real protection is RLS in the database — a trainer can only
// update swimmers they own (policy: is_admin() OR is_trainer_of_swimmer(id)).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Update ONLY the notes field for one swimmer.
// We deliberately touch nothing but `notes`, so we can never accidentally
// overwrite health_info or other columns.
export async function updateNotes(swimmerId: string, notes: string) {
  const supabase = await createClient();

  // 1. Confirm there is a logged-in user. (RLS still does the real check.)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Ikke innlogget" };
  }

  // 2. Trim whitespace. Store an empty note as NULL rather than "",
  //    so the profile shows "Ingen notater" cleanly.
  const trimmed = notes.trim();
  const value = trimmed === "" ? null : trimmed;

  // 3. Update only the `notes` column for this swimmer.
  //    If RLS forbids it (not this trainer's swimmer), `error` will be set.
  const { error } = await supabase
    .from("swimmers")
    .update({ notes: value })
    .eq("id", swimmerId);

  if (error) {
    // Log the real reason server-side (shows in Vercel logs), return a
    // friendly Norwegian message to the UI.
    console.error("updateNotes error:", error.message);
    return { error: "Kunne ikke lagre notatet. Prøv igjen." };
  }

  // 4. Refresh the profile page so the saved note shows immediately.
  revalidatePath(`/trener/svommer/${swimmerId}`);
  return { success: true };
}