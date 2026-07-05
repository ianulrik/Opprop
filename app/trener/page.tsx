// app/trener/page.tsx
// Trainer dashboard (lives at /trener).
//
// Server Component: runs on the server, so it can read the logged-in
// user and fetch data directly. The middleware already guarantees only
// logged-in users reach this page, but we still read the user here to
// know WHO they are (for the role check and to greet them).

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// One course row. These names come straight from your `courses` table.
type Course = {
  id: string;
  name: string;
  location: string;
  start_date: string;
  start_time: string;
};

// Reuse the same Norwegian formatting helpers as the public page.
function formatWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("nb-NO", { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

export default async function TrenerPage() {
  const supabase = await createClient();

  // 1. Who is logged in? getUser() revalidates against the Auth server,
  //    so it's safe to trust (unlike getSession()). Middleware should
  //    have caught a logged-out user already, but we guard anyway.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/trener/login");
  }

  // 2. Role check. Read this user's profile row to see if they're an
  //    admin or a trainer. (RLS lets a user read their own profile.)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  // NOTE: once /admin exists, we'll redirect admins there:
  //   if (profile?.role === "admin") redirect("/admin");
  // For now /admin doesn't exist, so redirecting would land on a 404.
  // Instead we just show the role below, and wire up the redirect later.

  // 3. This trainer's active courses. This is a plain select — your RLS
  //    policies make sure a trainer only sees their OWN courses, and an
  //    admin sees all. We just ask for non-archived ones, newest start
  //    first. No need to filter by trainer_id ourselves; RLS does it.
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, location, start_date, start_time")
    .eq("archived", false)
    .order("start_date", { ascending: true });

  const courses = (data ?? []) as Course[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Mine kurs</h1>
      <p className="mt-2 text-gray-600">
        Logget inn som {profile?.full_name || user.email}
        {/* Temporary: show the role so we can see the check works.
            Later this drives the admin redirect instead. */}
        {profile?.role === "admin" && " (administrator)"}
      </p>

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">
          Klarte ikke å hente kursene. Prøv igjen senere.
        </p>
      )}

      {!error && courses.length === 0 && (
        <p className="mt-8 rounded-lg bg-gray-50 p-4 text-gray-600">
          Du har ingen aktive kurs akkurat nå.
        </p>
      )}

      {courses.length > 0 && (
        <ul className="mt-8 space-y-4">
          {courses.map((course) => (
            <li key={course.id}>
              {/* Each course links to its attendance page (built later).
                  The link works now; the page will 404 until we build it. */}
              <Link
                href={`/trener/kurs/${course.id}/oppmote`}
                className="block rounded-lg border border-gray-200 p-4 hover:border-gray-400 hover:bg-gray-50"
              >
                <h2 className="text-lg font-semibold text-gray-900">
                  {course.name}
                </h2>
                <p className="text-gray-600">{course.location}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {formatWeekday(course.start_date)} kl.{" "}
                  {formatTime(course.start_time)} · oppstart{" "}
                  {formatDate(course.start_date)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}