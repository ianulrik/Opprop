// app/trener/kurs/[id]/oppmote/page.tsx
// Attendance page — part 1a: show the correct SESSION only.
// (Swimmers come in the next step.)
//
// Server Component. The [id] in the folder name is the course id; Next
// makes it available via `params`. An optional ?session=<id> in the URL
// lets the trainer override which session is shown (the prev/next
// buttons are just links that set it). With no ?session=, we default to
// the session closest to today — the most likely one.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OppmoteListe from "./oppmoteliste";

type Session = {
  id: string;
  course_id: string;
  session_number: number;
  session_date: string;
};

// One enrolled swimmer, as we fetch them for the attendance list.
// We deliberately fetch only what the list needs — no health/sensitive
// data here; that belongs on the swimmer profile page, not a poolside list.
type EnrolledSwimmer = {
  id: string;
  first_name: string;
  last_name: string;
  status: "present" | "absent" | "excused" | null;
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Pick the session whose date is closest to today (past or future).
function findClosestSession(sessions: Session[]): Session {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // compare dates only, ignore time of day

  return sessions.reduce((closest, current) => {
    const [cy, cm, cd] = current.session_date.split("-").map(Number);
    const currentDate = new Date(cy, cm - 1, cd);

    const [by, bm, bd] = closest.session_date.split("-").map(Number);
    const closestDate = new Date(by, bm - 1, bd);

    const currentDiff = Math.abs(currentDate.getTime() - today.getTime());
    const closestDiff = Math.abs(closestDate.getTime() - today.getTime());

    return currentDiff < closestDiff ? current : closest;
  });
}

// In App Router, params and searchParams are async — hence the awaits.
export default async function OppmotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { id: courseId } = await params;
  const { session: sessionIdFromUrl } = await searchParams;

  const supabase = await createClient();

  // Confirm the logged-in user (middleware already gated this route).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/trener/login");

  // Fetch the course. RLS ensures a trainer only gets their own course;
  // if it's not theirs (or doesn't exist), we get nothing -> 404.
  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  // Fetch all sessions for this course, in order.
  const { data: sessionsData } = await supabase
    .from("sessions")
    .select("id, course_id, session_number, session_date")
    .eq("course_id", courseId)
    .order("session_number", { ascending: true });

  const sessions = (sessionsData ?? []) as Session[];

  if (sessions.length === 0) {
    // Shouldn't happen (a trigger generates 10), but guard anyway.
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
        <p className="mt-4 text-gray-600">Fant ingen økter for dette kurset.</p>
      </main>
    );
  }

  // Which session are we showing? Use ?session= if it's valid for this
  // course; otherwise fall back to the one closest to today.
  const selected =
    sessions.find((s) => s.id === sessionIdFromUrl) ??
    findClosestSession(sessions);

  // Work out prev/next by session_number for the navigation buttons.
  const currentIndex = sessions.findIndex((s) => s.id === selected.id);
  const prev = currentIndex > 0 ? sessions[currentIndex - 1] : null;
  const next =
    currentIndex < sessions.length - 1 ? sessions[currentIndex + 1] : null;

    // Fetch the ACTIVE enrollments for this course, and pull each linked
  // swimmer's name in the same query. The `swimmers ( ... )` part tells
  // Supabase to follow the foreign key from enrollments to swimmers and
  // include those columns — so we get names without a second query.
  const { data: enrollmentsData } = await supabase
    .from("enrollments")
    .select("swimmers ( id, first_name, last_name )")
    .eq("course_id", courseId)
    .eq("status", "active");

  // Build the base swimmer list (names only), sorted for the poolside.
  const baseSwimmers = (enrollmentsData ?? [])
    .map((row) => row.swimmers as unknown as {
      id: string;
      first_name: string;
      last_name: string;
    })
    .filter(Boolean)
    .sort((a, b) => a.first_name.localeCompare(b.first_name, "nb"));

  // Fetch attendance already recorded for THIS session. Thanks to the
  // unique(session_id, swimmer_id) constraint, there's at most one row
  // per swimmer, so we can map swimmer_id -> status directly.
  const { data: attendanceData } = await supabase
    .from("attendance")
    .select("swimmer_id, status")
    .eq("session_id", selected.id);

  // Turn that into a quick lookup: swimmer_id -> status.
  const statusBySwimmer = new Map<string, "present" | "absent" | "excused">();
  for (const row of attendanceData ?? []) {
    statusBySwimmer.set(row.swimmer_id, row.status);
  }

  // Merge: each swimmer gets their recorded status, or null if none yet.
  const swimmers: EnrolledSwimmer[] = baseSwimmers.map((s) => ({
    ...s,
    status: statusBySwimmer.get(s.id) ?? null,
  }));

  const basePath = `/trener/kurs/${courseId}/oppmote`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* Back to dashboard */}
      <Link href="/trener" className="text-sm text-gray-500 hover:text-gray-700">
        ← Mine kurs
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">{course.name}</h1>

      {/* Session selector: prev — "Økt X av 10 / date" — next */}
      <div className="mt-6 flex items-center justify-between gap-4">
        {/* Previous session (or a disabled placeholder on the first one) */}
        {prev ? (
          <Link
            href={`${basePath}?session=${prev.id}`}
            className="rounded-lg border border-gray-300 px-4 py-3 text-lg hover:bg-gray-50"
          >
            ←
          </Link>
        ) : (
          <span className="rounded-lg border border-gray-100 px-4 py-3 text-lg text-gray-300">
            ←
          </span>
        )}

        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">
            Økt {selected.session_number} av {sessions.length}
          </p>
          <p className="text-sm text-gray-600">
            {formatDate(selected.session_date)}
          </p>
        </div>

        {/* Next session (or a disabled placeholder on the last one) */}
        {next ? (
          <Link
            href={`${basePath}?session=${next.id}`}
            className="rounded-lg border border-gray-300 px-4 py-3 text-lg hover:bg-gray-50"
          >
            →
          </Link>
        ) : (
          <span className="rounded-lg border border-gray-100 px-4 py-3 text-lg text-gray-300">
            →
          </span>
        )}
      </div>

      {/* Interactive attendance list (client component) */}
      {swimmers.length === 0 ? (
        <p className="mt-8 text-center text-gray-600">
          Ingen aktive svømmere er påmeldt dette kurset ennå.
        </p>
      ) : (
        <OppmoteListe sessionId={selected.id} swimmers={swimmers} />
      )}

      {swimmers.length > 0 && (
        <p className="mt-6 text-center text-sm text-gray-500">
          {swimmers.length} svømmere påmeldt
        </p>
      )}

      {/* A small count, handy for a quick headcount */}
      {swimmers.length > 0 && (
        <p className="mt-6 text-center text-sm text-gray-500">
          {swimmers.length} svømmere påmeldt
        </p>
      )}

      {swimmers.map((swimmer) => (
            <li
              key={swimmer.id}
              className="rounded-xl border border-gray-200 p-4"
            >
              <span className="text-xl font-medium text-gray-900">
                {swimmer.first_name} {swimmer.last_name}
              </span>
              {/* Temporary status readout — confirms we read the right
                  status per session. Replaced by buttons in the next step. */}
              <span className="ml-3 text-sm text-gray-500">
                {swimmer.status === "present"
                  ? "✓ Til stede"
                  : swimmer.status === "absent"
                  ? "✗ Ikke til stede"
                  : swimmer.status === "excused"
                  ? "– Gyldig fravær"
                  : "(ikke registrert)"}
              </span>
            </li>
          ))}
    </main>
  );
}