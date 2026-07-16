
// Server Actions for the admin area.

// "use server" means these functions run on the server. A plain HTML
// <form> can post directly to them — no client-side JavaScript needed.
//
// IMPORTANT: a Server Action is effectively a public endpoint. Even
// though the form only appears for admins, we re-check the role here.
// Never rely on the page's check alone. (RLS is still the real backstop.)

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCourse(formData: FormData) {
  const supabase = await createClient();

  // 1. Who's calling?
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/trener/login");

  // 2. Are they actually an admin?
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return redirect("/trener");
  }

  // 3. Pull the values out of the submitted form. Everything arrives as
  //    strings, so max_participants needs converting to a number.
  const name = formData.get("name") as string;
  const location = formData.get("location") as string;
  const startDate = formData.get("start_date") as string;
  const startTime = formData.get("start_time") as string;
  const maxParticipants = Number(formData.get("max_participants"));
  const trainerId = formData.get("trainer_id") as string;

  // 4. Insert. We only send these fields — the database fills in the
  //    rest by itself: end_date and weekday are generated columns, and
  //    a trigger creates the 10 sessions once the course exists.
  const { error } = await supabase.from("courses").insert({
    name,
    location,
    start_date: startDate,
    start_time: startTime,
    max_participants: maxParticipants,
    // An empty dropdown selection means "no trainer yet" -> null.
    trainer_id: trainerId || null,
  });

  if (error) {
    // Send the message back to the page via the URL so it can show it.
    // (Keeps this server-only — no client state needed.)
    return redirect(`/admin?feil=${encodeURIComponent(error.message)}`);
  }

  // 5. Tell Next.js the /admin page's data is stale, so the new course
  //    shows up in the list right away.
  revalidatePath("/admin");
  redirect("/admin?opprettet=1");
}