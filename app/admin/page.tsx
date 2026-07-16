// Server Component. Middleware already ensured the visitor is logged in;
// here we check WHICH role they have and send non-admins away.
//
// Remember: these checks are about sending people to the right place —
// the real protection is RLS in the database. A trainer who somehow
// reached this page would simply see their own courses, not everyone's.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// One course row, with the assigned trainer's name pulled in via the
// trainer_id foreign key.
type Course = {
  id: string;
  name: string;
  location: string;
  start_date: string;
  start_time: string;
  max_participants: number;
  archived: boolean;
  profiles: { full_name: string | null } | null;
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatWeekday(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString("nb-NO", { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

export default async function AdminPage() {
  const supabase = await createClient();

  // Who's logged in? (Middleware guaranteed there IS someone.)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect("/trener/login");

  // THE ROLE CHECK: only admins belong here.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return redirect("/trener");
  }

  // All courses — admins see everything, thanks to RLS. We include
  // archived ones here (unlike the trainer dashboard) since managing
  // them is part of the admin's job.
  //
  // `profiles ( full_name )` follows courses.trainer_id to get the
  // assigned trainer's name in the same query.
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, name, location, start_date, start_time, max_participants, archived, profiles ( full_name )"
    )
    .order("start_date", { ascending: false });

  const courses = (data ?? []) as unknown as Course[];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Administrasjon</h1>
      <p className="mt-2 text-gray-600">
        Logget inn som {profile?.full_name || user.email} (administrator)
      </p>

      <form action="/trener/logout" method="post" className="mt-4">
        <button
          type="submit"
          className="text-sm text-gray-500 underline hover:text-gray-700"
        >
          Logg ut
        </button>
      </form>

      <h2 className="mt-10 text-xl font-semibold text-gray-900">Alle kurs</h2>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
          Klarte ikke å hente kursene. Prøv igjen senere.
        </p>
      )}

      {!error && courses.length === 0 && (
        <p className="mt-4 rounded-lg bg-gray-50 p-4 text-gray-600">
          Ingen kurs er opprettet ennå.
        </p>
      )}

      {courses.length > 0 && (
        <ul className="mt-4 space-y-3">
          {courses.map((course) => (
            <li
              key={course.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {course.name}
                    {/* Archived courses are dimmed with a small tag */}
                    {course.archived && (
                      <span className="ml-2 rounded bg-gray-100 px-2 py-1 text-xs font-normal text-gray-600">
                        Arkivert
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600">{course.location}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatWeekday(course.start_date)} kl.{" "}
                    {formatTime(course.start_time)} · oppstart{" "}
                    {formatDate(course.start_date)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Maks {course.max_participants} deltakere
                  </p>
                </div>

                {/* Assigned trainer, or a clear warning when missing */}
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Trener
                  </p>
                  {course.profiles?.full_name ? (
                    <p className="text-sm text-gray-900">
                      {course.profiles.full_name}
                    </p>
                  ) : (
                    <p className="text-sm text-amber-700">Ikke tildelt</p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}