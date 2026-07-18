// Server Component. Middleware already ensured the visitor is logged in;
// here we check WHICH role they have and send non-admins away.
//
// Remember: these checks are about sending people to the right place —
// the real protection is RLS in the database. A trainer who somehow
// reached this page would simply see their own courses, not everyone's.


import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NyttKursSkjema from "./NyttKursSkjema";
import { updateCourseTrainer } from "./actions";

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
  trainer_id: string | null; 
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

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ opprettet?: string; oppdatert?: string; feil?: string }>;
}) {
  const { opprettet, oppdatert, feil } = await searchParams;
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
      "id, name, location, start_date, start_time, max_participants, archived, trainer_id, profiles ( full_name )"
    )
    .order("start_date", { ascending: false });

  const courses = (data ?? []) as unknown as Course[];
  // All trainers, for the dropdown. Admins can read every profile,
  // so this returns the whole staff list.
  const { data: trainersData } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "trainer")
    .order("full_name", { ascending: true });

  const trainers = trainersData ?? [];

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


      {/* Feedback after creating a course */}
      {opprettet && (
        <p className="mt-6 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Kurset ble opprettet.
        </p>
      )}
      {oppdatert && (
        <p className="mt-6 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Treneren ble oppdatert.
        </p>
      )}
      {feil && (
        <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Kunne ikke opprette kurset: {feil}
        </p>
      )}

      {/* Create a new course */}
      <h2 className="mt-10 text-xl font-semibold text-gray-900">Nytt kurs</h2>
      <NyttKursSkjema trainers={trainers} />


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

                {/* Assign or change the trainer. A small form per course,
                    posting to the updateCourseTrainer action. The hidden
                    field tells the action WHICH course this is. */}
                <form action={updateCourseTrainer} className="text-right">
                  <input type="hidden" name="course_id" value={course.id} />

                  <label className="block text-xs uppercase tracking-wide text-gray-400">
                    Trener
                  </label>

                  <select
                    name="trainer_id"
                    // defaultValue (not value) so the dropdown starts on the
                    // current trainer but the admin can freely change it.
                    defaultValue={course.trainer_id ?? ""}
                    className="mt-1 rounded-lg border border-gray-300 p-2 text-sm"
                  >
                    <option value="">Ikke tildelt</option>
                    {trainers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email || "Uten navn"}
                      </option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    className="mt-2 block w-full rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Lagre
                  </button>
                </form>

              </div>


              {/* kopiereing av kurs */}
              <details className="mt-4 border-t border-gray-100 pt-4">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Kopier til ny termin
                </summary>

                <form action={copyCourse} className="mt-3 space-y-3">
                  <input type="hidden" name="source_id" value={course.id} />

                  <div>
                    <label className="block text-sm font-medium text-gray-900">
                      Ny startdato
                    </label>
                    <input
                      type="date"
                      name="new_start_date"
                      required
                      className="mt-1 rounded-lg border border-gray-300 p-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900">
                      Trener
                    </label>
                    <select
                      name="trainer_id"
                      defaultValue=""
                      className="mt-1 rounded-lg border border-gray-300 p-2 text-sm"
                    >
                      <option value="">Behold samme trener</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name || t.email || "Uten navn"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Kopier kurs
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}