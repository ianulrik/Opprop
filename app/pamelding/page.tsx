
// Server Component: fetches the course list on the server, shows it,
// and then renders the registration form (a client component) below it,
// passing the courses in as a prop.

import { createClient } from "@/lib/supabase/server";
import PameldingSkjema from "./pameldingSkjema"; //bring in the form

// The shape of one course, as returned by the public_active_courses() RPC.
type Course = {
  id: string;
  name: string;
  location: string;
  weekday: number;
  start_time: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  spots_left: number;
};

// --- Small display helpers (Norwegian formatting) ---

function formatWeekday(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString("nb-NO", { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5);
}

// --- The page ---

export default async function PameldingPage() {
  const supabase = await createClient();

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

      
      {!error && courses.length === 0 && (
        <p className="mt-8 rounded-lg bg-gray-50 p-4 text-gray-600">
          Det er ingen aktive kurs akkurat nå. Kom gjerne tilbake senere.
        </p>
      )}

      {/* liste av kurs */}
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
              <p className="mt-2 text-sm font-medium">
                {course.spots_left > 0 ? (
                  <span className="text-green-700">
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

      {/* the registration form, shown whenever there are courses to pick */}
      {courses.length > 0 && <PameldingSkjema courses={courses} />}
    </main>
  );
}