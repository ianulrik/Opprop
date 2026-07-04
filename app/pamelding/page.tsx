// app/pamelding/page.tsx
// Public registration page (no login required).
//
// This is a Server Component (no "use client" at the top), so it runs
// on the server. That lets us fetch the course list directly with
// `await` before the page is sent to the browser.
//
// For now it just LISTS the courses. In the next step we add the
// actual registration form on top of this.

import { createClient } from "@/lib/supabase/server";

// The shape of one course, as returned by the public_active_courses() RPC.
// (These names come straight from that function's SELECT.)
type Course = {
  id: string;
  name: string;
  location: string;
  weekday: number;        // a number (0–6), which is why we don't use it directly
  start_time: string;     // e.g. "17:30:00"
  start_date: string;     // e.g. "2026-01-15"
  end_date: string;
  max_participants: number;
  spots_left: number;     // computed by the RPC; never below 0
};

// --- Small display helpers (Norwegian formatting) ---

// Weekday derived from the start date. We compute it from the date itself
// (rather than trusting the `weekday` number) so we never have to guess
// whether 0 means Sunday or Monday. Splitting the "YYYY-MM-DD" string and
// building the Date from its parts avoids any timezone shifting.
function formatWeekday(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day); // local time, no UTC surprises
  const weekday = date.toLocaleDateString("nb-NO", { weekday: "long" }); // "mandag"
  // Capitalise the first letter since it starts a line in the UI.
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

// "2026-01-15" -> "15. januar 2026"
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// "17:30:00" -> "17:30"
function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

// --- The page ---

export default async function PameldingPage() {
  const supabase = await createClient();

  // The RPC returns a JSON array directly, so `data` IS our list of courses.
  const { data, error } = await supabase.rpc("public_active_courses");
  const courses = (data ?? []) as Course[];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Meld på svømmekurs</h1>
      <p className="mt-2 text-gray-600">
        Velg et kurs nedenfor og fyll ut påmeldingsskjemaet.
      </p>

      {/* If the fetch failed */}
      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-red-700">
          Beklager, vi klarte ikke å hente kursene akkurat nå. Prøv igjen senere.
        </p>
      )}

      {/* If there are no active courses */}
      {!error && courses.length === 0 && (
        <p className="mt-8 rounded-lg bg-gray-50 p-4 text-gray-600">
          Det er ingen aktive kurs akkurat nå. Kom gjerne tilbake senere.
        </p>
      )}

      {/* The list of courses */}
      {courses.length > 0 && (
        <ul className="mt-8 space-y-4">
          {courses.map((course) => (
            <li key={course.id} className="rounded-lg border border-gray-200 p-4">
              <h2 className="text-lg font-semibold text-gray-900">{course.name}</h2>
              <p className="text-gray-600">{course.location}</p>
              <p className="mt-1 text-sm text-gray-600">
                {formatWeekday(course.start_date)} kl. {formatTime(course.start_time)}
              </p>
              <p className="text-sm text-gray-600">
                Oppstart {formatDate(course.start_date)}
              </p>

              {/* Free spots, or waitlist when full */}
              <p className="mt-2 text-sm font-medium">
                {course.spots_left > 0 ? (
                  <span className="text-green-700">
                    {/* Singular/plural so the Norwegian reads correctly */}
                    {course.spots_left === 1
                      ? "1 ledig plass"
                      : `${course.spots_left} ledige plasser`}
                  </span>
                ) : (
                  <span className="text-amber-700">Fullt – venteliste</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
